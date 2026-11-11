import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { createApp } from '../app.mjs';

const directory = mkdtempSync(join(tmpdir(), 'apex-security-'));
const databasePath = join(directory, 'test.sqlite');
let app, store, server, base, memberCookie, secondCookie, adminCookie, memberId, purchaseId, mediaUrl, redemptionId;
const password = 'Test-password-long-2026!';
async function request(path, { method = 'GET', body, cookie, origin, client = true } = {}) {
  const response = await fetch(base + path, {
    method, headers: { ...(client ? { 'X-Apex-Client': 'web' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  return { response, data };
}
before(async () => {
  execFileSync(process.execPath, ['server/create-admin.mjs', '--local'], { env: { ...process.env, DATABASE_PATH: databasePath, APEX_ADMIN_EMAIL: 'owner@example.test', APEX_ADMIN_PASSWORD: password, APEX_ADMIN_NAME: 'APEX Owner' } });
  ({ app, store } = await createApp({ databasePath, production: false }));
  server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise((resolve) => server.close(resolve)); store.db.close(); rmSync(directory, { recursive: true, force: true }); });

test('public state excludes all private management data', async () => {
  const { data } = await request('/api/bootstrap');
  assert.equal(data.user, null); assert.equal(data.firms.length, 12);
  for (const key of ['members', 'allPurchases', 'allRedemptions', 'auditLog', 'passwordHash', 'sessions']) assert.equal(data[key], undefined);
  for (const path of ['/api/admin/state', '/api/admin/export']) assert.equal((await request(path)).response.status, 401);
  assert.equal((await request('/api/auth/setup-admin', { method: 'POST', body: {} })).response.status, 404);
});
test('normal registration cannot grant an administrator role', async () => {
  const { response, data } = await request('/api/auth/register', { method: 'POST', body: { name: 'Normal Member', email: 'member@example.test', password, role: 'admin', suspended: false } });
  assert.equal(response.status, 201); assert.equal(data.user.role, 'member'); memberId = data.user.id;
  memberCookie = response.headers.get('set-cookie').split(';')[0];
  assert.match(response.headers.get('set-cookie'), /HttpOnly/); assert.match(response.headers.get('set-cookie'), /SameSite=Lax/);
  assert.doesNotMatch(JSON.stringify(data), /password_hash|passwordHash|scrypt:|salt/);
  const second = await request('/api/auth/register', { method: 'POST', body: { name: 'Other Member', email: 'other@example.test', password } });
  secondCookie = second.response.headers.get('set-cookie').split(';')[0];
});
test('members cannot read or mutate administration, upload logos, or use admin login', async () => {
  for (const [path, method, body] of [
    ['/api/admin/state', 'GET'], ['/api/admin/export', 'GET'],
    ['/api/admin/settings', 'PUT', { creditRate: 100 }],
    ['/api/admin/media', 'POST', { dataUrl: 'anything' }],
    ['/api/admin/members/' + memberId, 'PATCH', { role: 'admin', suspended: false }],
    ['/api/admin/purchases/fake', 'PATCH', { status: 'approved' }],
  ]) assert.equal((await request(path, { method, body, cookie: memberCookie })).response.status, 403, path);
  assert.equal((await request('/api/auth/admin-login', { method: 'POST', body: { email: 'member@example.test', password } })).response.status, 403);
  assert.equal((await request('/api/admin/state', { cookie: 'apex_session=forged-admin-session' })).response.status, 401);
});
test('cross-site mutations and requests without the CSRF header are blocked', async () => {
  assert.equal((await request('/api/profile', { method: 'PATCH', body: { name: 'Bad Name' }, cookie: memberCookie, origin: 'https://attacker.example' })).response.status, 403);
  assert.equal((await request('/api/profile', { method: 'PATCH', body: { name: 'Bad Name' }, cookie: memberCookie, client: false })).response.status, 403);
  const result = await request('/api/profile', { method: 'PATCH', body: { name: 'Normal Member', role: 'admin' }, cookie: memberCookie });
  assert.equal(result.response.status, 200);
  assert.equal((await request('/api/bootstrap', { cookie: memberCookie })).data.user.role, 'member');
});
test('purchase rates, status and credits are calculated by the server', async () => {
  const result = await request('/api/purchases', { method: 'POST', cookie: memberCookie, body: { firmId: 'shark-funded', orderId: 'ORDER-1', amount: 2000, codeUsed: 'TFC', purchaseDate: new Date().toISOString(), notes: 'Order for verification', cashbackRate: 100, cashbackAmount: 99999, creditsEarned: 99999, status: 'approved', userId: 'forged' } });
  assert.equal(result.response.status, 201);
  const data = (await request('/api/bootstrap', { cookie: memberCookie })).data;
  const purchase = data.purchases[0]; purchaseId = purchase.id;
  assert.equal(purchase.userId, memberId); assert.equal(purchase.status, 'pending'); assert.equal(purchase.cashbackRate, 8); assert.equal(purchase.cashbackAmount, 160); assert.equal(data.credits.available, 0); assert.equal(data.credits.pending, 2000);
  assert.equal((await request('/api/purchases/' + purchaseId, { method: 'PATCH', cookie: memberCookie, body: { status: 'approved' } })).response.status, 404);
  assert.equal((await request('/api/bootstrap', { cookie: secondCookie })).data.purchases.length, 0);
});
test('the owner signs in through a server session and approves the purchase', async () => {
  const login = await request('/api/auth/admin-login', { method: 'POST', body: { email: 'owner@example.test', password } });
  assert.equal(login.response.status, 200); assert.equal(login.data.user.role, 'admin'); adminCookie = login.response.headers.get('set-cookie').split(';')[0];
  const approved = await request('/api/admin/purchases/' + purchaseId, { method: 'PATCH', cookie: adminCookie, body: { status: 'approved', adminNote: 'Private attribution evidence' } });
  assert.equal(approved.response.status, 200);
  const member = (await request('/api/bootstrap', { cookie: memberCookie })).data;
  assert.equal(member.purchases[0].status, 'approved'); assert.equal(member.credits.available, 2000); assert.equal(member.purchases[0].adminNote, undefined);
  const admin = (await request('/api/admin/state', { cookie: adminCookie })).data;
  assert.equal(admin.allPurchases[0].adminNote, 'Private attribution evidence'); assert.ok(admin.auditLog.length > 0);
  assert.doesNotMatch(JSON.stringify(admin), /password_hash|scrypt:|token_hash/);
});
test('reward costs are authoritative and reserved credits cannot be spent twice', async () => {
  const first = await request('/api/redemptions', { method: 'POST', cookie: memberCookie, body: { itemId: 'challenge-10', cost: 1, itemName: 'Free reward', status: 'fulfilled' } });
  assert.equal(first.response.status, 201);
  let state = (await request('/api/bootstrap', { cookie: memberCookie })).data;
  redemptionId = state.redemptions[0].id; assert.equal(state.redemptions[0].cost, 1000); assert.equal(state.redemptions[0].status, 'requested'); assert.equal(state.credits.available, 1000);
  assert.equal((await request('/api/redemptions/' + redemptionId, { method: 'DELETE', cookie: secondCookie })).response.status, 403);
  assert.equal((await request('/api/redemptions', { method: 'POST', cookie: memberCookie, body: { itemId: 'challenge-10' } })).response.status, 201);
  assert.equal((await request('/api/redemptions', { method: 'POST', cookie: memberCookie, body: { itemId: 'challenge-10' } })).response.status, 409);
  assert.equal((await request('/api/redemptions/' + redemptionId, { method: 'DELETE', cookie: memberCookie })).response.status, 200);
  state = (await request('/api/bootstrap', { cookie: memberCookie })).data; assert.equal(state.credits.available, 1000);
});
test('image uploads are validated, saved, and used by the public website', async () => {
  const bad = await request('/api/admin/media', { method: 'POST', cookie: adminCookie, body: { dataUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' } });
  assert.equal(bad.response.status, 400);
  const bytes = await sharp({ create: { width: 64, height: 64, channels: 4, background: '#72e7ff' } }).png().toBuffer();
  const upload = await request('/api/admin/media', { method: 'POST', cookie: adminCookie, body: { dataUrl: 'data:image/png;base64,' + bytes.toString('base64') } });
  assert.equal(upload.response.status, 201); mediaUrl = upload.data.url;
  const image = await fetch(base + mediaUrl); assert.equal(image.status, 200); assert.match(image.headers.get('content-type'), /image\/webp/);
  const state = (await request('/api/admin/state', { cookie: adminCookie })).data;
  assert.equal((await request('/api/admin/settings', { method: 'PUT', cookie: adminCookie, body: { ...state.platformSettings, siteLogo: mediaUrl, reviewModeration: true } })).response.status, 200);
  const firm = state.firms.find((item) => item.id === 'shark-funded');
  assert.equal((await request('/api/admin/firms/shark-funded', { method: 'PUT', cookie: adminCookie, body: { ...firm, logo: mediaUrl } })).response.status, 200);
  const guest = (await request('/api/bootstrap')).data; assert.equal(guest.platformSettings.siteLogo, mediaUrl); assert.equal(guest.firms.find((item) => item.id === 'shark-funded').logo, mediaUrl);
});
test('moderation keeps unpublished reviews private and only admins can publish them', async () => {
  const input = { firmId: 'shark-funded', rating: 4, title: 'Useful account experience', body: 'The account platform and support were easy to use. Here is a specific experience with the trading rules.', accountModel: '2 Step', recommend: true, status: 'published' };
  assert.equal((await request('/api/reviews', { method: 'POST', cookie: memberCookie, body: input })).response.status, 200);
  const member = (await request('/api/bootstrap', { cookie: memberCookie })).data; const review = member.reviews.find((item) => item.userId === memberId);
  assert.equal(review.status, 'pending'); assert.equal((await request('/api/bootstrap')).data.reviews.length, 0);
  assert.equal((await request('/api/reviews/' + review.id, { method: 'DELETE', cookie: secondCookie })).response.status, 403);
  assert.equal((await request('/api/admin/reviews/' + review.id, { method: 'PATCH', cookie: adminCookie, body: { status: 'published' } })).response.status, 200);
  assert.equal((await request('/api/bootstrap')).data.reviews.length, 1);
});
test('exports exclude credentials and imports cannot inject roles or accounts', async () => {
  const report = (await request('/api/admin/export', { cookie: adminCookie })).data;
  assert.equal(report.version, 2); assert.doesNotMatch(JSON.stringify(report), /password_hash|passwordHash|token_hash|scrypt:/);
  assert.equal((await request('/api/admin/firms/import', { method: 'POST', cookie: memberCookie, body: { firms: [], users: [{ role: 'admin' }] } })).response.status, 403);
  assert.equal((await request('/api/admin/members/' + report.members.find((item) => item.role === 'admin').id, { method: 'PATCH', cookie: adminCookie, body: { role: 'member', suspended: false } })).response.status, 409);
});
test('data and sessions survive a backend restart', async () => {
  await new Promise((resolve) => server.close(resolve)); store.db.close();
  ({ app, store } = await createApp({ databasePath, production: false }));
  server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`;
  const data = (await request('/api/bootstrap', { cookie: memberCookie })).data;
  assert.equal(data.user.id, memberId); assert.equal(data.purchases.length, 1); assert.equal(data.platformSettings.siteLogo, mediaUrl);
  assert.equal((await fetch(base + mediaUrl)).status, 200);
});
test('suspending a member revokes existing sessions', async () => {
  assert.equal((await request('/api/admin/members/' + memberId, { method: 'PATCH', cookie: adminCookie, body: { role: 'member', suspended: true } })).response.status, 200);
  assert.equal((await request('/api/bootstrap', { cookie: memberCookie })).data.user, null);
  assert.equal((await request('/api/profile', { method: 'PATCH', cookie: memberCookie, body: { name: 'Still active?' } })).response.status, 401);
});