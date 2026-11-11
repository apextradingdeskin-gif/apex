import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomBytes, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { catalog, openStore, publicUser } from './database.mjs';
import { hashPassword, verifyPassword, tokenHash, HttpError } from './security.mjs';
import * as schema from './validation.mjs';
import { cashbackBalance, ensurePurchaseChangeCovered } from './finance.mjs';
import { mountPayoutRoutes } from './payout-routes.mjs';
import { availablePayoutMethods, seedPayoutMethods } from './payout-methods.mjs';
import { createPayoutVault, migrateLegacyPayouts } from './payout-vault.mjs';
import { mountLaunchReadiness } from './launch-readiness.mjs';
import { databaseFailure, safeServerMessage } from './diagnostics.mjs';
import { createActivation, mountAttributionAdmin, mountPartnerWebhook } from './attribution.mjs';
export async function createApp(options = {}) {
    const store = options.store ?? await openStore(options);
    const { db, list, get, put, remove, settings } = store;
    let vault;
    try {
        vault = createPayoutVault(options, store.kind);
        await seedPayoutMethods(store);
        await migrateLegacyPayouts(store, vault);
    } catch (error) { if (!options.store) await db.close(); throw error; }
    const app = express();
    const secure = options.production ?? process.env.NODE_ENV === 'production';
    const cookieName = secure ? '__Host-apex_session' : 'apex_session';
    const dummyHash = await hashPassword(randomBytes(32).toString('hex'));
    app.disable('x-powered-by');
    if (process.env.TRUST_PROXY === '1')
        app.set('trust proxy', 1);
    // The existing single-file Vite build uses inline scripts and external brand media.
    app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
    app.use(cookieParser());
    app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 1000, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many requests. Try again shortly.' } }));
    mountPartnerWebhook(app, store);
    app.use('/api', (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
            const origin = req.get('origin');
            const configured = process.env.PUBLIC_ORIGIN;
            let valid = !origin;
            try {
                valid = !origin || (configured ? origin === new URL(configured).origin : new URL(origin).host === req.get('host'));
            }
            catch {
                valid = false;
            }
            if (!valid || req.get('sec-fetch-site') === 'cross-site' || req.get('x-apex-client') !== 'web')
                return res.status(403).json({ message: 'Cross-site or unauthorised request blocked.' });
        }
        next();
    });
    app.use('/api', express.json({ limit: '6mb', type: 'application/json' }));
    app.use('/api', async (req, _res, next) => {
        if (req.path === '/health') return next();
        const token = req.cookies[cookieName];
        if (token && /^[a-f0-9]{64}$/.test(token)) {
            const row = await db.prepare('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?').get(tokenHash(token), Date.now());
            if (row && !row.suspended)
                req.user = publicUser(row);
        }
        next();
    });
    const requireUser = (req, _res, next) => req.user ? next() : next(new HttpError(401, 'Please sign in to continue.'));
    const requireAdmin = (req, _res, next) => req.user?.role === 'admin' ? next() : next(new HttpError(req.user ? 403 : 401, 'Administrator access is required.'));
    const audit = async (req, action, target, detail) => await put('audit', { id: randomUUID(), actor: req.user.email, action, target, detail, createdAt: new Date().toISOString() });
    const requireItem = async (table, id) => { const item = await get(table, id); if (!item)
        throw new HttpError(404, 'Record not found.'); return item; };
    const requireOwner = (item, req) => { if (item.userId !== req.user.id)
        throw new HttpError(403, 'This record belongs to another member.'); };
    const safePurchase = ({ adminNote, ...item }) => item;
    const creditBalance = async (userId) => {
        const config = await settings();
        const purchases = await list('purchases', userId);
        const earn = (statuses) => purchases.filter((item) => statuses.includes(item.status) && item.verification !== 'refunded' && !item.amountMismatch).reduce((sum, item) => sum + (item.creditsEarned ?? Math.floor(item.amount * config.creditRate)), 0);
        const spent = (await list('redemptions', userId)).filter((item) => item.status !== 'cancelled').reduce((sum, item) => sum + item.cost, 0);
        return { pending: earn(['pending']), available: Math.max(0, earn(['approved', 'paid']) - spent), spent, lifetime: earn(['pending', 'approved', 'paid']) };
    };
    const validateMedia = async (value) => { if (value?.startsWith('/api/media/') && !await db.prepare('SELECT id FROM media WHERE id=?').get(value.split('/').pop()))
        throw new HttpError(400, 'This uploaded image is missing. Please upload it again.'); };
    const startSession = async (req, res, row) => {
        const previous = req.cookies[cookieName];
        if (previous)
            await db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(previous));
        const token = randomBytes(32).toString('hex');
        const ttl = row.role === 'admin' ? 8 * 3600000 : 7 * 86400000;
        await db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
        await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(tokenHash(token), row.id, Date.now() + ttl);
        res.cookie(cookieName, token, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: ttl });
    };
    app.get('/api/health', async (_req, res) => {
        try {
            await db.prepare('SELECT 1 AS alive').get();
            res.json({ ok: true, ready: true, service: 'apex-account-api', database: store.kind, authentication: 'server-session' });
        } catch (error) {
            const failure = databaseFailure(error);
            res.status(503).json({ ok: false, ready: false, service: 'apex-account-api', code: failure?.code ?? 'DATABASE_UNAVAILABLE', message: failure ? `${failure.message} ${failure.action}` : 'The account database is currently unavailable. Check the server terminal.' });
        }
    });
    app.get('/api/bootstrap', async (req, res) => {
        const user = req.user ?? null;
        const ownReviews = (await list('reviews')).filter((review) => review.status === 'published' || (!review.status) || review.userId === user?.id);
        res.json({
            service: 'apex-account-api', schemaVersion: 1,
            user, firms: (await list('firms')).filter((firm) => firm.status !== 'archived'), platformSettings: await settings(),
            reviews: ownReviews, purchases: user ? (await list('purchases', user.id)).map(safePurchase) : [],
            redemptions: user ? await list('redemptions', user.id) : [], referralClicks: user ? await list('clicks', user.id) : [],
            credits: user ? await creditBalance(user.id) : { pending: 0, available: 0, spent: 0, lifetime: 0 },
            payouts: user ? (await list('payouts', user.id)).map(vault.publicRow) : [],
            payoutMethods: await availablePayoutMethods(store),
            storage: { database: store.kind },
            cashback: user ? await cashbackBalance(store, user.id) : { pending: 0, available: 0, reserved: 0, paid: 0, approved: 0, total: 0 },
        });
    });
    const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, skipSuccessfulRequests: true, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many sign-in attempts. Try again in 15 minutes.' } });
    app.use('/api/auth', authLimiter);
    app.post('/api/auth/register', async (req, res) => {
        const input = schema.registration.parse(req.body);
        if (await db.prepare('SELECT id FROM users WHERE email=?').get(input.email))
            throw new HttpError(409, 'An account with that email already exists. Please log in.');
        const passwordHash = await hashPassword(input.password);
        const id = randomUUID();
        const referral = `APX-${randomBytes(4).toString('hex').slice(0, 6).toUpperCase()}`;
        try {
            await db.prepare('INSERT INTO users(id,email,name,password_hash,role,referral_code,referred_by,created_at) VALUES(?,?,?,?,?,?,?,?)').run(id, input.email, input.name, passwordHash, 'member', referral, input.referredBy ?? null, new Date().toISOString());
        }
        catch (error) {
            if (String(error.code).includes('CONSTRAINT') || error.code === '23505')
                throw new HttpError(409, 'That email is already registered.');
            throw error;
        }
        const row = await db.prepare('SELECT * FROM users WHERE id=?').get(id);
        await startSession(req, res, row);
        res.status(201).json({ ok: true, message: 'Your APEX account is ready.', user: publicUser(row) });
    });
    const login = (adminOnly) => async (req, res) => {
        const input = schema.credentials.parse(req.body);
        const row = await db.prepare('SELECT * FROM users WHERE email=?').get(input.email);
        const valid = await verifyPassword(input.password, row?.password_hash ?? dummyHash);
        if (!row || !valid) throw new HttpError(401, 'Email or password is incorrect.');
        if (row.suspended) throw new HttpError(403, 'This account is suspended. Contact support if you need help restoring access.');
        if (adminOnly && row.role !== 'admin')
            throw new HttpError(403, 'This account does not have administrator access.');
        await startSession(req, res, row);
        res.json({ ok: true, message: `Welcome back, ${row.name.split(' ')[0]}.`, user: publicUser(row) });
    };
    app.post('/api/auth/login', login(false));
    app.post('/api/auth/admin-login', login(true));
    app.post('/api/auth/logout', async (req, res) => {
        const token = req.cookies[cookieName];
        if (token)
            await db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(token));
        res.clearCookie(cookieName, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
        res.json({ ok: true, message: 'You have been logged out.' });
    });
    app.patch('/api/profile', requireUser, async (req, res) => {
        const { name } = z.object({ name: z.string().trim().min(2).max(100) }).parse(req.body);
        await db.transaction(async () => {
            await db.prepare('UPDATE users SET name=? WHERE id=?').run(name, req.user.id);
            for (const review of await list('reviews', req.user.id))
                await put('reviews', { ...review, userName: name });
        })();
        res.json({ ok: true, message: 'Profile updated.' });
    });
    app.post('/api/purchases', requireUser, async (req, res) => {
        const input = schema.purchaseSchema.parse(req.body);
        await db.transaction(async () => {
        const config = await settings();
        if (!config.cashbackEnabled)
            throw new HttpError(409, 'Cashback submissions are temporarily paused.');
        const firm = await requireItem('firms', input.firmId);
        if (firm.status === 'archived')
            throw new HttpError(409, 'This firm is not accepting new submissions.');
        if (new Date(input.purchaseDate).getTime() > Date.now() + 86400000)
            throw new HttpError(400, 'Purchase date cannot be in the future.');
        if ((await list('purchases')).some((item) => item.firmId === input.firmId && item.orderId.toLowerCase() === input.orderId.toLowerCase()))
            throw new HttpError(409, 'This order has already been submitted for this firm.');
        const rate = firm.cashbackRate ?? 3;
        const purchase = { ...input, id: randomUUID(), userId: req.user.id, status: 'pending', source: 'member', verification: 'unverified', cashbackRate: rate, cashbackAmount: Math.round(input.amount * rate) / 100, creditsEarned: Math.floor(input.amount * config.creditRate), creditRateAtPurchase: config.creditRate, createdAt: new Date().toISOString() };
        await put('purchases', purchase);
        })();
        res.status(201).json({ ok: true, message: 'Purchase saved and sent for verification.' });
    });
    app.post('/api/reviews', requireUser, async (req, res) => {
        const input = schema.reviewSchema.parse(req.body);
        await requireItem('firms', input.firmId);
        const existing = (await list('reviews', req.user.id)).find((item) => item.firmId === input.firmId);
        const status = (await settings()).reviewModeration ? 'pending' : 'published';
        await put('reviews', { ...input, id: existing?.id ?? randomUUID(), userId: req.user.id, userName: req.user.name, createdAt: existing?.createdAt ?? new Date().toISOString(), updatedAt: existing ? new Date().toISOString() : undefined, status });
        res.json({ ok: true, message: status === 'pending' ? 'Review submitted for moderation.' : 'Your review has been published.' });
    });
    app.delete('/api/reviews/:id', requireUser, async (req, res) => { const item = await requireItem('reviews', req.params.id); requireOwner(item, req); await remove('reviews', item.id); res.json({ ok: true, message: 'Review deleted.' }); });
    app.post('/api/clicks', requireUser, async (req, res) => {
        const { firmId } = z.object({ firmId: z.string().max(80) }).parse(req.body);
        res.json(await createActivation(store, req.user, firmId));
    });
    app.post('/api/redemptions', requireUser, async (req, res) => {
        const { itemId } = z.object({ itemId: z.string().max(80) }).parse(req.body);
        const reward = catalog.rewards.find((item) => item.id === itemId);
        if (!reward)
            throw new HttpError(404, 'Reward not found.');
        await db.transaction(async () => {
            const balance = await creditBalance(req.user.id);
            if (balance.available < reward.cost)
                throw new HttpError(409, `You need ${(reward.cost - balance.available).toLocaleString()} more approved credits.`);
            await put('redemptions', { id: randomUUID(), userId: req.user.id, itemId: reward.id, itemName: reward.name, cost: reward.cost, status: 'requested', createdAt: new Date().toISOString() });
        })();
        res.status(201).json({ ok: true, message: `${reward.name} requested. Credits reserved.` });
    });
    app.delete('/api/redemptions/:id', requireUser, async (req, res) => {
        await db.transaction(async () => {
        const item = await requireItem('redemptions', req.params.id);
        requireOwner(item, req);
        if (item.status !== 'requested')
            throw new HttpError(409, 'Only requested rewards can be cancelled.');
        await put('redemptions', { ...item, status: 'cancelled' });
        })();
        res.json({ ok: true, message: 'Redemption cancelled. Credits released.' });
    });
    // Every admin route verifies the current server-side role, including uploads and exports.
    app.use('/api/admin', requireAdmin);
    mountPayoutRoutes(app, store, { requireUser, audit, vault });
    mountLaunchReadiness(app, store, vault);
    mountAttributionAdmin(app, store, { audit });
    const adminState = async () => ({ members: (await db.prepare('SELECT * FROM users ORDER BY created_at DESC').all()).map(publicUser), firms: await list('firms'), allPurchases: await list('purchases'), allRedemptions: await list('redemptions'), allClicks: await list('clicks'), reviews: await list('reviews'), auditLog: (await list('audit')).slice(0, 300), platformSettings: await settings(), payoutMethods: await availablePayoutMethods(store, true), allPayouts: (await list('payouts')).map(vault.publicRow), conversions: await list('conversions') });
    app.get('/api/admin/state', async (_req, res) => res.json(await adminState()));
    app.patch('/api/admin/purchases/:id', async (req, res) => {
        const patch = schema.purchaseUpdate.parse(req.body);
        await db.transaction(async () => {
        const item = await requireItem('purchases', req.params.id);
        const next = { ...item, status: patch.status, adminNote: patch.adminNote, reviewedAt: new Date().toISOString() };
        if (patch.verifiedAmount !== undefined) {
            next.amount = patch.verifiedAmount;
            next.cashbackAmount = Math.round(next.amount * item.cashbackRate) / 100;
            next.creditsEarned = Math.floor(next.amount * (item.creditRateAtPurchase ?? (await settings()).creditRate));
            next.amountMismatch = item.partnerAmount !== undefined && Math.round(item.partnerAmount * 100) !== Math.round(next.amount * 100);
        }
        if (patch.status === 'approved' && (next.verification === 'refunded' || next.amountMismatch))
            throw new HttpError(409, 'Resolve the refunded or mismatched partner amount before approving cashback.');
        await ensurePurchaseChangeCovered(store, next);
        await put('purchases', next);
        await audit(req, 'Purchase updated', item.orderId, `${item.status} to ${patch.status}.`);
        })();
        res.json({ ok: true, message: 'Purchase verification saved.' });
    });
    app.patch('/api/admin/redemptions/:id', async (req, res) => {
        const { status } = schema.redemptionUpdate.parse(req.body);
        await db.transaction(async () => {
        const item = await requireItem('redemptions', req.params.id);
        if (item.status === 'cancelled' && status !== 'cancelled' && (await creditBalance(item.userId)).available < item.cost)
            throw new HttpError(409, 'This member no longer has sufficient credits to reopen the request.');
        await put('redemptions', { ...item, status, fulfilledAt: status === 'fulfilled' ? new Date().toISOString() : undefined });
        await audit(req, 'Redemption updated', item.itemName, `${item.status} to ${status}.`);
        })();
        res.json({ ok: true, message: 'Redemption status updated.' });
    });
    app.patch('/api/admin/reviews/:id', async (req, res) => {
        const { status } = schema.reviewUpdate.parse(req.body);
        const item = await requireItem('reviews', req.params.id);
        await put('reviews', { ...item, status });
        await audit(req, 'Review moderated', item.title, `Visibility: ${status}.`);
        res.json({ ok: true, message: 'Review visibility updated.' });
    });
    app.delete('/api/admin/reviews/:id', async (req, res) => { const item = await requireItem('reviews', req.params.id); await remove('reviews', item.id); await audit(req, 'Review deleted', item.title, 'Permanently removed.'); res.json({ ok: true, message: 'Review deleted.' }); });
    app.patch('/api/admin/members/:id', async (req, res) => {
        const patch = schema.userUpdate.parse(req.body);
        await db.transaction(async () => {
        const row = await db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
        if (!row)
            throw new HttpError(404, 'Member not found.');
        if (row.id === req.user.id && (patch.suspended || patch.role !== 'admin'))
            throw new HttpError(409, 'You cannot remove your own administrator access.');
        if (row.role === 'admin' && (patch.role !== 'admin' || patch.suspended) && (await db.prepare("SELECT count(*) AS total FROM users WHERE role='admin' AND suspended=0").get()).total <= 1)
            throw new HttpError(409, 'At least one active administrator must remain.');
        await db.prepare('UPDATE users SET role=?,suspended=? WHERE id=?').run(patch.role, Number(patch.suspended), row.id);
        if (patch.suspended || patch.role !== row.role)
            await db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.id);
        await audit(req, 'Member updated', row.email, `Role: ${patch.role}; suspended: ${patch.suspended}.`);
        })();
        res.json({ ok: true, message: patch.suspended ? 'Member suspended. Existing sessions were revoked.' : 'Member access restored. They can sign in again.' });
    });
    app.put('/api/admin/firms/:id', async (req, res) => {
        const firm = schema.firmSchema.parse(req.body);
        if (firm.id !== req.params.id)
            throw new HttpError(400, 'Firm ID does not match.');
        await validateMedia(firm.logo);
        await put('firms', firm);
        await audit(req, 'Firm saved', firm.name, `Cashback ${firm.cashbackRate}%; ${firm.status}.`);
        res.json({ ok: true, message: `${firm.name} saved.` });
    });
    app.patch('/api/admin/firms/:id', async (req, res) => {
        const { archived } = z.object({ archived: z.boolean() }).parse(req.body);
        const firm = await requireItem('firms', req.params.id);
        await put('firms', { ...firm, status: archived ? 'archived' : 'active' });
        await audit(req, archived ? 'Firm archived' : 'Firm restored', firm.name, 'Directory visibility updated.');
        res.json({ ok: true, message: archived ? 'Firm archived.' : 'Firm restored.' });
    });
    app.put('/api/admin/settings', async (req, res) => {
        const input = schema.settingsSchema.parse(req.body);
        const config = { ...await settings(), ...input, contact: { ...(await settings()).contact, ...input.contact } };
        await validateMedia(config.siteLogo);
        await db.prepare('UPDATE settings SET data=? WHERE id=1').run(JSON.stringify(config));
        await audit(req, 'Settings saved', 'Website settings', 'Branding, rewards and moderation configuration updated.');
        res.json({ ok: true, message: 'Website settings saved.' });
    });
    app.post('/api/admin/media', async (req, res) => {
        const { dataUrl } = schema.mediaInput.parse(req.body);
        const source = Buffer.from(dataUrl.split(',')[1], 'base64');
        if (source.length > 4 * 1024 * 1024)
            throw new HttpError(413, 'Choose an image smaller than 4 MB.');
        const png = source.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        const jpeg = source[0] === 255 && source[1] === 216 && source[2] === 255;
        const webp = source.subarray(0, 4).toString() === 'RIFF' && source.subarray(8, 12).toString() === 'WEBP';
        if (!png && !jpeg && !webp)
            throw new HttpError(400, 'Only valid PNG, JPEG or WebP images are supported.');
        let content;
        try {
            content = await sharp(source, { limitInputPixels: 20000000, failOn: 'warning' }).rotate().resize(768, 768, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
        }
        catch {
            throw new HttpError(400, 'The image is damaged or too large to decode.');
        }
        const id = tokenHash(content);
        await db.prepare('INSERT INTO media(id,content,mime,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING').run(id, content, 'image/webp', new Date().toISOString());
        await audit(req, 'Logo uploaded', id.slice(0, 12), 'Image validated and stored.');
        res.status(201).json({ ok: true, url: `/api/media/${id}` });
    });
    app.get('/api/media/:id', async (req, res) => {
        if (!/^[a-f0-9]{64}$/.test(req.params.id))
            throw new HttpError(404, 'Image not found.');
        const image = await db.prepare('SELECT content,mime FROM media WHERE id=?').get(req.params.id);
        if (!image)
            throw new HttpError(404, 'Image not found.');
        res.set({ 'Content-Type': image.mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' }).send(Buffer.from(image.content));
    });
    app.get('/api/admin/export', async (_req, res) => res.json({ version: 2, exportedAt: new Date().toISOString(), ...await adminState() }));
    app.post('/api/admin/firms/import', async (req, res) => {
        const input = z.object({ firms: z.array(schema.firmSchema).min(1).max(100) }).parse(req.body);
        for (const firm of input.firms)
            await validateMedia(firm.logo);
        await db.transaction(async () => { for (const firm of input.firms)
            await put('firms', firm); })();
        await audit(req, 'Firm catalog imported', `${input.firms.length} listings`, 'Validated firm data imported; no accounts or permissions changed.');
        res.json({ ok: true, message: `${input.firms.length} firm listings imported.` });
    });
    app.use('/api', (_req, res) => res.status(404).json({ message: 'API endpoint not found.' }));
    app.use((error, _req, res, _next) => {
        if (error instanceof z.ZodError)
            return res.status(400).json({ message: error.issues[0]?.message ?? 'Invalid request data.' });
        if (error.type === 'entity.too.large')
            return res.status(413).json({ message: 'Upload is too large.' });
        if (error instanceof SyntaxError && 'body' in error)
            return res.status(400).json({ message: 'Invalid JSON body.' });
        const database = databaseFailure(error);
        if (database && !error.status) {
            console.error('Account database error:', database.code, safeServerMessage(error.message));
            return res.status(503).json({ code: database.code, message: `${database.message} ${database.action}` });
        }
        if (!error.status) console.error('API error:', safeServerMessage(error.message));
        res.status(error.status ?? 500).json({ message: error.status ? error.message : 'The server could not complete that request.' });
    });
    return { app, store };
}
