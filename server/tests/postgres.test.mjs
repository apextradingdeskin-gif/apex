import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import sharp from 'sharp';
import { openPostgresStore } from '../postgres-store.mjs';
import { createApp } from '../app.mjs';
import { hashPassword } from '../security.mjs';

test('Supabase Postgres adapter: private schema, RLS, sessions, payouts and transaction rollback', async () => {
  const engine = new PGlite();
  await engine.exec('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;');
  let tail = Promise.resolve();
  const acquire = async () => { const previous = tail; let release; tail = new Promise((resolve) => { release = resolve; }); await previous; return release; };
  const execute = async (sql, values = []) => {
    if (sql.includes('CREATE SCHEMA IF NOT EXISTS')) { await engine.exec(sql); return { rows: [], rowCount: 0 }; }
    return engine.query(sql, values);
  };
  const pool = {
    async query(sql, values) { const release = await acquire(); try { return await execute(sql, values); } finally { release(); } },
    async connect() { const release = await acquire(); return { query: execute, release }; },
    end: () => engine.close(),
  };
  const store = await openPostgresStore('', { pool });
  const adminId = randomUUID(); const password = 'Postgres-test-password-2026!';
  await store.db.prepare("INSERT INTO users(id,email,name,password_hash,role,referral_code,created_at) VALUES(?,?,?,?, 'admin',?,?)").run(adminId, 'pg-owner@example.test', 'Postgres Owner', await hashPassword(password), 'APX-PGOWNR', new Date().toISOString());
  const { app } = await createApp({ store, encryptionKey: '01'.repeat(32), production: false });
  const server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function request(path, method = 'GET', body, cookie) {
    const response = await fetch(origin + path, { method, headers: { 'X-Apex-Client': 'web', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  try {
    const member = await request('/api/auth/register', 'POST', { name: 'Postgres Member', email: 'pg-member@example.test', password, role: 'admin' });
    assert.equal(member.status, 201); assert.equal(member.data.user.role, 'member');
    const admin = await request('/api/auth/admin-login', 'POST', { email: 'pg-owner@example.test', password });
    assert.equal(admin.status, 200);
    assert.equal((await request('/api/admin/state', 'GET', undefined, member.cookie)).status, 403);
    await request('/api/purchases', 'POST', { firmId: 'shark-funded', orderId: 'PG-ORDER', amount: 1000, purchaseDate: new Date().toISOString() }, member.cookie);
    const state = (await request('/api/admin/state', 'GET', undefined, admin.cookie)).data;
    const purchase = state.allPurchases.find((item) => item.orderId === 'PG-ORDER');
    assert.ok(purchase); assert.equal(state.payoutMethods.length, 3);
    await request('/api/admin/purchases/' + purchase.id, 'PATCH', { status: 'approved', adminNote: 'Postgres verified invoice' }, admin.cookie);
    const input = { amount: 50, methodId: 'paypal', methodVersion: 1, answers: { payee_name: 'Postgres Member', paypal_email: 'private-payout@example.test' }, requestKey: randomUUID() };
    assert.equal((await request('/api/payouts', 'POST', input, member.cookie)).status, 201);
    const memberState = (await request('/api/bootstrap', 'GET', undefined, member.cookie)).data;
    assert.equal(memberState.cashback.available, 30); assert.equal(memberState.cashback.reserved, 50);
    assert.equal(memberState.payouts[0].encryptedAnswers, undefined); assert.equal(memberState.payouts[0].answers, undefined);
    const raw = (await store.list('payouts'))[0]; assert.ok(raw.encryptedAnswers); assert.equal(JSON.stringify(raw).includes('private-payout@example.test'), false);
    assert.equal((await request('/api/admin/payouts/' + raw.id + '/details', 'GET', undefined, member.cookie)).status, 403);
    const details = (await request('/api/admin/payouts/' + raw.id + '/details', 'GET', undefined, admin.cookie)).data;
    assert.equal(details.answers.paypal_email, 'private-payout@example.test');
    const image = await sharp({ create: { width: 32, height: 32, channels: 4, background: '#72e7ff' } }).png().toBuffer();
    const upload = await request('/api/admin/media', 'POST', { dataUrl: 'data:image/png;base64,' + image.toString('base64') }, admin.cookie);
    assert.equal(upload.status, 201);
    const media = await fetch(origin + upload.data.url); assert.equal(media.status, 200); assert.match(media.headers.get('content-type'), /image\/webp/);
    assert.ok((await media.arrayBuffer()).byteLength > 0);
    const settings = (await request('/api/bootstrap')).data.platformSettings;
    assert.equal((await request('/api/admin/settings', 'PUT', { ...settings, siteLogo: upload.data.url }, admin.cookie)).status, 200);
    assert.equal((await request('/api/bootstrap')).data.platformSettings.siteLogo, upload.data.url);
    await assert.rejects(store.db.transaction(async () => {
      await store.put('audit', { id: 'ROLLBACK-CHECK', action: 'Should not persist' });
      throw new Error('Force rollback');
    })());
    assert.equal(await store.get('audit', 'ROLLBACK-CHECK'), null);
    const rls = await engine.query("SELECT relname,relrowsecurity FROM pg_class JOIN pg_namespace ON pg_namespace.oid=pg_class.relnamespace WHERE nspname='apex_private' AND relkind='r'");
    assert.ok(rls.rows.length >= 15); assert.equal(rls.rows.every((row) => row.relrowsecurity), true);
    await engine.exec('SET ROLE anon;');
    try { await assert.rejects(engine.query('SELECT * FROM apex_private.users'), /permission denied/); }
    finally { await engine.exec('RESET ROLE;'); }
    assert.equal((await request('/api/health')).data.database, 'supabase-postgres');
  } finally { await new Promise((resolve) => server.close(resolve)); await store.db.close(); }
});