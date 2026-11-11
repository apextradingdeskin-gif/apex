import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import express from 'express';
import { conversionEvent } from './validation.mjs';
import { HttpError, tokenHash } from './security.mjs';
async function matchMember(store, firmId, event, explicitUserId) {
    const candidates = new Set();
    const existing = (await store.list('purchases')).find((item) => item.firmId === firmId && item.orderId.toLowerCase() === event.orderId.toLowerCase());
    if (explicitUserId)
        candidates.add(explicitUserId);
    if (event.clickId) {
        const click = await store.get('clicks', event.clickId);
        if (click?.firmId === firmId)
            candidates.add(click.userId);
    }
    for (const [column, value] of [['referral_code', event.memberCode], ['email', event.buyerEmail]]) {
        if (value) {
            const user = await store.db.prepare(`SELECT id FROM users WHERE ${column}=? AND suspended=0`).get(value);
            if (user)
                candidates.add(user.id);
        }
    }
    if (candidates.size !== 1)
        return { userId: null, existing, reason: candidates.size ? 'Conflicting member identifiers. Review before matching.' : 'No matching member or click. A shared coupon alone cannot identify the buyer.' };
    const userId = [...candidates][0];
    if (existing && existing.userId !== userId)
        return { userId: null, existing, reason: 'This order was claimed by another member. Verify ownership before matching.' };
    if (!await store.db.prepare('SELECT id FROM users WHERE id=? AND suspended=0').get(userId))
        return { userId: null, existing, reason: 'The matching member is not active.' };
    return { userId, existing, reason: 'Matched using order, click, member code or partner checkout email.' };
}
async function applyMatch(store, conversion, explicitUserId) {
    const match = await matchMember(store, conversion.firmId, conversion, explicitUserId);
    const result = { ...conversion, userId: match.userId ?? undefined, match: match.userId ? 'matched' : 'unmatched', matchReason: match.reason };
    // A trusted refund can freeze a known order without inferring a new buyer or awarding money.
    if (conversion.status === 'refunded' && match.existing) {
        await store.put('purchases', { ...match.existing, verification: 'refunded', conversionId: conversion.id, status: match.existing.status === 'pending' ? 'rejected' : match.existing.status });
        return { ...result, userId: match.existing.userId, purchaseId: match.existing.id, match: 'matched', matchReason: 'Refund reconciled to the existing order. No new reward was issued.' };
    }
    if (!match.userId)
        return result;
    const firm = await store.get('firms', conversion.firmId);
    const existing = match.existing;
    const refunded = conversion.status === 'refunded' || existing?.verification === 'refunded';
    const amountMismatch = Boolean(existing && ['approved', 'paid'].includes(existing.status) && Math.round(existing.amount * 100) !== Math.round(conversion.amount * 100));
    const amount = amountMismatch ? existing.amount : conversion.amount;
    const rate = existing?.cashbackRate ?? firm.cashbackRate ?? 3;
    const creditRate = existing?.creditRateAtPurchase ?? (await store.settings()).creditRate;
    const purchase = {
        ...existing, id: existing?.id ?? randomUUID(), userId: match.userId, firmId: conversion.firmId,
        orderId: existing?.orderId ?? conversion.orderId, amount, cashbackRate: rate,
        cashbackAmount: Math.round(amount * rate) / 100, creditsEarned: Math.floor(amount * creditRate), creditRateAtPurchase: creditRate,
        codeUsed: conversion.couponCode || existing?.codeUsed || '', purchaseDate: existing?.purchaseDate ?? conversion.purchasedAt,
        createdAt: existing?.createdAt ?? new Date().toISOString(), notes: existing?.notes ?? 'Purchase received from a partner report.',
        source: existing?.source ?? (conversion.source === 'webhook' ? 'partner' : 'partner_report'),
        verification: refunded ? 'refunded' : conversion.source === 'webhook' ? 'partner_confirmed' : 'report_matched',
        conversionId: conversion.id, partnerAmount: conversion.amount, amountMismatch,
        status: refunded && (!existing || existing.status === 'pending') ? 'rejected' : existing?.status ?? 'pending',
    };
    await store.put('purchases', purchase);
    return { ...result, purchaseId: purchase.id, amountMismatch };
}
async function recordEvent(store, firmId, event, source, explicitUserId) {
    const firm = await store.get('firms', firmId);
    if (!firm)
        throw new HttpError(404, 'Firm not found.');
    const id = tokenHash(`${firmId}:${event.eventId}`);
    const payloadHash = tokenHash(JSON.stringify(event));
    const old = await store.get('conversions', id);
    if (old) {
        if (old.payloadHash !== payloadHash)
            throw new HttpError(409, 'This event ID has already been used with different data.');
        return { conversion: old, duplicate: true };
    }
    const receipt = { ...event, id, firmId, source, payloadHash, receivedAt: new Date().toISOString() };
    const conversion = await applyMatch(store, receipt, explicitUserId);
    await store.put('conversions', conversion);
    return { conversion, duplicate: false };
}
export function mountPartnerWebhook(app, store) {
    // Webhooks do not use browser cookies. Only this exact route accepts signed partner traffic.
    app.post('/api/partners/:firmId/conversions', express.raw({ type: 'application/json', limit: '128kb' }), async (req, res) => {
        const key = await store.db.prepare('SELECT secret FROM partner_keys WHERE firm_id=?').get(req.params.firmId);
        const timestamp = req.get('x-apex-timestamp') ?? '';
        const signature = req.get('x-apex-signature') ?? '';
        if (!key || !Buffer.isBuffer(req.body) || !/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature))
            throw new HttpError(401, 'A valid partner signature is required.');
        if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300)
            throw new HttpError(401, 'Webhook timestamp has expired.');
        const expected = createHmac('sha256', key.secret).update(`${timestamp}.`).update(req.body).digest();
        const supplied = Buffer.from(signature, 'hex');
        if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied))
            throw new HttpError(401, 'Partner signature verification failed.');
        let event;
        try {
            event = JSON.parse(req.body.toString('utf8'));
        }
        catch {
            throw new HttpError(400, 'Invalid webhook JSON.');
        }
        event = conversionEvent.parse(event);
        const result = await store.db.transaction(async () => {
            const recorded = await recordEvent(store, req.params.firmId, event, 'webhook');
            if (!recorded.duplicate)
                await store.put('audit', { id: randomUUID(), actor: `partner:${req.params.firmId}`, action: 'Partner sale received', target: event.orderId, detail: `${event.status}; ${recorded.conversion.match}.`, createdAt: new Date().toISOString() });
            return recorded;
        })();
        res.json({ ok: true, duplicate: result.duplicate, matched: result.conversion.match === 'matched' });
    });
}
export async function createActivation(store, user, firmId) {
    const firm = await store.get('firms', firmId);
    if (!firm || firm.status === 'archived')
        throw new HttpError(404, 'This firm is not currently available.');
    const click = { id: randomUUID(), userId: user.id, firmId, createdAt: new Date().toISOString(), partnerLink: Boolean(firm.affiliateUrl) };
    const url = new URL(firm.affiliateUrl || firm.website);
    url.searchParams.set(firm.trackingParameter || 'apex_click', click.id);
    url.searchParams.set('utm_source', 'apextrading');
    url.searchParams.set('utm_medium', 'affiliate');
    await store.put('clicks', click);
    return { ok: true, message: 'Referral activation recorded. A sale is confirmed only after a partner report.', clickId: click.id, redirectUrl: url.toString() };
}
export function mountAttributionAdmin(app, store, { audit }) {
    app.get('/api/admin/integrations', async (_req, res) => {
        const conversions = await store.list('conversions');
        const result = await Promise.all((await store.list('firms')).map(async (firm) => ({
            firmId: firm.id, name: firm.name, affiliateUrl: firm.affiliateUrl ?? '', trackingParameter: firm.trackingParameter || 'apex_click',
            webhookConfigured: Boolean(await store.db.prepare('SELECT firm_id FROM partner_keys WHERE firm_id=?').get(firm.id)),
            endpoint: `/api/partners/${firm.id}/conversions`, lastReceivedAt: conversions.find((item) => item.firmId === firm.id && item.source === 'webhook')?.receivedAt ?? null,
        })));
        res.json(result);
    });
    app.post('/api/admin/integrations/:firmId/rotate', async (req, res) => {
        if (!await store.get('firms', req.params.firmId))
            throw new HttpError(404, 'Firm not found.');
        const secret = randomBytes(32).toString('hex');
        await store.db.prepare('INSERT INTO partner_keys(firm_id,secret,created_at) VALUES(?,?,?) ON CONFLICT(firm_id) DO UPDATE SET secret=excluded.secret,created_at=excluded.created_at').run(req.params.firmId, secret, new Date().toISOString());
        await audit(req, 'Partner key rotated', req.params.firmId, 'New signing key created. The previous key is invalid.');
        res.json({ ok: true, secret, endpoint: `/api/partners/${req.params.firmId}/conversions`, message: 'Signing key created. Copy it now; it is not shown again.' });
    });
    app.post('/api/admin/conversions', async (req, res) => {
        const { firmId, ...rest } = z.object({ firmId: z.string().max(80), ...conversionEvent.shape }).parse(req.body);
        const result = await store.db.transaction(async () => await recordEvent(store, firmId, rest, 'partner_report'))();
        await audit(req, 'Partner report recorded', rest.orderId, `Manual partner report; ${result.conversion.match}.`);
        res.status(result.duplicate ? 200 : 201).json({ ok: true, message: result.conversion.match === 'matched' ? 'Partner sale matched. Review the pending cashback in Purchases.' : 'Sale recorded as unmatched. Select the correct member before approving cashback.' });
    });
    app.patch('/api/admin/conversions/:id', async (req, res) => {
        const { userId } = z.object({ userId: z.string().uuid() }).parse(req.body);
        const receipt = await store.get('conversions', req.params.id);
        if (!receipt)
            throw new HttpError(404, 'Conversion receipt not found.');
        const updated = await store.db.transaction(async () => {
            const result = await applyMatch(store, receipt, userId);
            if (result.match !== 'matched' || result.userId !== userId)
                throw new HttpError(409, result.matchReason);
            await store.put('conversions', result);
            return result;
        })();
        await audit(req, 'Partner sale matched', updated.orderId, `Matched to member ${userId}.`);
        res.json({ ok: true, message: 'Sale matched to member. Cashback remains pending until approved.' });
    });
}
