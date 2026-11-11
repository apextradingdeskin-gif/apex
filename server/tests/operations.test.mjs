import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createApp } from '../app.mjs';

const directory = mkdtempSync(join(tmpdir(), 'apex-operations-'));
const databasePath = join(directory, 'operations.sqlite');
const password = 'Operations-test-password-2026!';
let server, store, base, admin, member, other, memberId, purchaseId, requestedId, clickId, secret;
async function request(path, { method = 'GET', body, cookie, headers = {} } = {}) {
  const response = await fetch(base + path, { method, headers: { 'X-Apex-Client': 'web', ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
}
async function signEvent(event, { key = secret, timestamp = String(Math.floor(Date.now() / 1000)), signature, firmId = 'shark-funded' } = {}) {
  const raw = JSON.stringify(event);
  const digest = signature ?? createHmac('sha256', key).update(`${timestamp}.${raw}`).digest('hex');
  const response = await fetch(`${base}/api/partners/${firmId}/conversions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Apex-Timestamp': timestamp, 'X-Apex-Signature': digest }, body: raw });
  return { status: response.status, data: await response.json() };
}
const payout = (amount, extra = {}) => ({ amount, method: 'PayPal', payeeName: 'Test Member', destination: 'member@example.test', requestKey: randomUUID(), ...extra });
before(async () => {
  execFileSync(process.execPath, ['server/create-admin.mjs', '--local'], { env: { ...process.env, DATABASE_PATH: databasePath, APEX_ADMIN_EMAIL: 'operations-owner@example.test', APEX_ADMIN_PASSWORD: password } });
  const built = await createApp({ databasePath, production: false }); store = built.store;
  server = built.app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`;
  const ownerLogin = await fetch(base + '/api/auth/admin-login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Apex-Client': 'web' }, body: JSON.stringify({ email: 'operations-owner@example.test', password }) });
  admin = ownerLogin.headers.get('set-cookie').split(';')[0];
  for (const [email, name] of [['member@example.test', 'Test Member'], ['other@example.test', 'Other Member']]) {
    const response = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Apex-Client': 'web' }, body: JSON.stringify({ email, name, password }) });
    const data = await response.json();
    if (email.startsWith('member')) { member = response.headers.get('set-cookie').split(';')[0]; memberId = data.user.id; }
    else other = response.headers.get('set-cookie').split(';')[0];
  }
});
after(async () => { await new Promise((resolve) => server.close(resolve)); store.db.close(); rmSync(directory, { recursive: true, force: true }); });

test('payout requests need authentication, approved funds and the minimum amount', async () => {
  assert.equal((await request('/api/payouts', { method: 'POST', body: payout(25) })).status, 401);
  await request('/api/purchases', { method: 'POST', cookie: member, body: { firmId: 'shark-funded', orderId: 'CASHBACK-BASE', amount: 2000, purchaseDate: new Date().toISOString(), codeUsed: 'APEX', notes: '' } });
  const state = (await request('/api/bootstrap', { cookie: member })).data; purchaseId = state.purchases[0].id;
  assert.equal(state.cashback.available, 0); assert.equal(state.cashback.pending, 160);
  assert.equal((await request('/api/payouts', { method: 'POST', cookie: member, body: payout(25) })).status, 409);
  assert.equal((await request('/api/payouts', { method: 'POST', cookie: member, body: payout(24) })).status, 400);
  assert.equal((await request('/api/payouts', { method: 'POST', cookie: member, body: payout(-1) })).status, 400);
});
test('payouts reserve money, are idempotent and cannot spend pending or reserved funds', async () => {
  await request('/api/admin/purchases/' + purchaseId, { method: 'PATCH', cookie: admin, body: { status: 'approved', adminNote: 'Verified invoice' } });
  const input = payout(60);
  assert.equal((await request('/api/payouts', { method: 'POST', cookie: member, body: input })).status, 201);
  assert.equal((await request('/api/payouts', { method: 'POST', cookie: member, body: input })).status, 200);
  const state = (await request('/api/bootstrap', { cookie: member })).data;
  requestedId = state.payouts[0].id; assert.equal(state.payouts.length, 1); assert.equal(state.cashback.reserved, 60); assert.equal(state.cashback.available, 100);
  assert.equal((await request('/api/payouts', { method: 'POST', cookie: member, body: payout(150) })).status, 409);
  assert.equal((await request('/api/payouts/' + requestedId, { method: 'DELETE', cookie: other })).status, 403);
  assert.equal((await request('/api/admin/payouts/' + requestedId, { method: 'PATCH', cookie: member, body: { status: 'paid', paymentReference: 'FAKE' } })).status, 403);
  assert.equal((await request('/api/admin/purchases/' + purchaseId, { method: 'PATCH', cookie: admin, body: { status: 'rejected', adminNote: 'Cannot invalidate reserved money' } })).status, 409);
});
test('cancellation releases money and paid requests need a reference and cannot be processed twice', async () => {
  assert.equal((await request('/api/payouts/' + requestedId, { method: 'DELETE', cookie: member })).status, 200);
  assert.equal((await request('/api/bootstrap', { cookie: member })).data.cashback.available, 160);
  await request('/api/payouts', { method: 'POST', cookie: member, body: payout(100) });
  let state = (await request('/api/bootstrap', { cookie: member })).data;
  const id = state.payouts.find((item) => item.status === 'requested').id;
  assert.equal((await request('/api/admin/payouts/' + id, { method: 'PATCH', cookie: admin, body: { status: 'processing', note: 'Review complete' } })).status, 200);
  assert.equal((await request('/api/payouts/' + id, { method: 'DELETE', cookie: member })).status, 409);
  assert.equal((await request('/api/admin/payouts/' + id, { method: 'PATCH', cookie: admin, body: { status: 'paid' } })).status, 400);
  assert.equal((await request('/api/admin/payouts/' + id, { method: 'PATCH', cookie: admin, body: { status: 'paid', paymentReference: 'PAY-100-VERIFIED', note: 'Transferred by administrator' } })).status, 200);
  assert.equal((await request('/api/admin/payouts/' + id, { method: 'PATCH', cookie: admin, body: { status: 'paid', paymentReference: 'PAY-100-VERIFIED' } })).status, 409);
  state = (await request('/api/bootstrap', { cookie: member })).data;
  assert.equal(state.cashback.paid, 100); assert.equal(state.cashback.available, 60); assert.equal(state.cashback.reserved, 0);
  await request('/api/payouts', { method: 'POST', cookie: member, body: payout(40) });
  const rejectedId = (await request('/api/bootstrap', { cookie: member })).data.payouts.find((item) => item.status === 'requested').id;
  assert.equal((await request('/api/admin/payouts/' + rejectedId, { method: 'PATCH', cookie: admin, body: { status: 'rejected' } })).status, 400);
  await request('/api/admin/payouts/' + rejectedId, { method: 'PATCH', cookie: admin, body: { status: 'rejected', note: 'Please correct your payout destination.' } });
  assert.equal((await request('/api/bootstrap', { cookie: member })).data.cashback.available, 60);
});
test('affiliate activations carry a unique click ID without pretending a click is a sale', async () => {
  const firm = (await request('/api/admin/state', { cookie: admin })).data.firms.find((item) => item.id === 'shark-funded');
  await request('/api/admin/firms/shark-funded', { method: 'PUT', cookie: admin, body: { ...firm, affiliateUrl: 'https://partner.example/join?ref=APEX-OWNER', trackingParameter: 'subid' } });
  const activated = await request('/api/clicks', { method: 'POST', cookie: member, body: { firmId: 'shark-funded' } });
  assert.equal(activated.status, 200); clickId = activated.data.clickId;
  const url = new URL(activated.data.redirectUrl); assert.equal(url.searchParams.get('ref'), 'APEX-OWNER'); assert.equal(url.searchParams.get('subid'), clickId);
  assert.equal((await request('/api/admin/state', { cookie: admin })).data.conversions.length, 0);
  assert.equal((await request('/api/bootstrap')).data.conversions, undefined);
});
test('partner keys are private and only authenticated administrators can create them', async () => {
  assert.equal((await request('/api/admin/integrations/shark-funded/rotate', { method: 'POST', cookie: member })).status, 403);
  const created = await request('/api/admin/integrations/shark-funded/rotate', { method: 'POST', cookie: admin });
  assert.equal(created.status, 200); secret = created.data.secret; assert.match(secret, /^[a-f0-9]{64}$/);
  const metadata = (await request('/api/admin/integrations', { cookie: admin })).data;
  assert.equal(metadata.find((item) => item.firmId === 'shark-funded').webhookConfigured, true);
  assert.equal(JSON.stringify(metadata).includes(secret), false);
  assert.equal(JSON.stringify((await request('/api/admin/export', { cookie: admin })).data).includes(secret), false);
});
test('signed sale events are matched without automatically approving money and are idempotent', async () => {
  const event = { eventId: 'partner-sale-001', orderId: 'PARTNER-ORDER', amount: 300, currency: 'USD', status: 'completed', purchasedAt: new Date().toISOString(), clickId, couponCode: 'APEX-OWNER' };
  assert.equal((await signEvent(event, { signature: '0'.repeat(64) })).status, 401);
  assert.equal((await signEvent(event, { timestamp: String(Math.floor(Date.now() / 1000) - 1000) })).status, 401);
  const received = await signEvent(event); assert.equal(received.status, 200); assert.equal(received.data.matched, true);
  const duplicate = await signEvent(event); assert.equal(duplicate.status, 200); assert.equal(duplicate.data.duplicate, true);
  assert.equal((await signEvent({ ...event, amount: 999 })).status, 409);
  const memberState = (await request('/api/bootstrap', { cookie: member })).data;
  const purchase = memberState.purchases.find((item) => item.orderId === 'PARTNER-ORDER');
  assert.equal(purchase.status, 'pending'); assert.equal(purchase.verification, 'partner_confirmed'); assert.equal(purchase.cashbackAmount, 24);
  assert.equal(memberState.credits.pending, 300); assert.equal(memberState.cashback.available, 60);
  assert.equal((await request('/api/bootstrap', { cookie: other })).data.purchases.length, 0);
  const state = (await request('/api/admin/state', { cookie: admin })).data;
  assert.equal(state.conversions.length, 1);
});
test('a shared coupon without a member identifier stays unmatched until admin reconciliation', async () => {
  const event = { eventId: 'partner-sale-002', orderId: 'SHARED-COUPON-ORDER', amount: 250, currency: 'USD', status: 'completed', purchasedAt: new Date().toISOString(), couponCode: 'APEX-OWNER' };
  const received = await signEvent(event); assert.equal(received.data.matched, false);
  const receipt = (await request('/api/admin/state', { cookie: admin })).data.conversions.find((item) => item.orderId === event.orderId);
  assert.equal(receipt.match, 'unmatched');
  assert.equal((await request('/api/admin/conversions/' + receipt.id, { method: 'PATCH', cookie: member, body: { userId: memberId } })).status, 403);
  assert.equal((await request('/api/admin/conversions/' + receipt.id, { method: 'PATCH', cookie: admin, body: { userId: memberId } })).status, 200);
  assert.equal((await request('/api/bootstrap', { cookie: member })).data.purchases.find((item) => item.orderId === event.orderId).status, 'pending');
});
test('refund reports do not leave pending refunded cashback spendable', async () => {
  const refund = { eventId: 'partner-refund-001', orderId: 'PARTNER-ORDER', amount: 300, currency: 'USD', status: 'refunded', purchasedAt: new Date().toISOString(), clickId, couponCode: 'APEX-OWNER' };
  assert.equal((await signEvent(refund)).status, 200);
  const state = (await request('/api/bootstrap', { cookie: member })).data;
  const purchase = state.purchases.find((item) => item.orderId === 'PARTNER-ORDER'); assert.equal(purchase.verification, 'refunded'); assert.equal(purchase.status, 'rejected');
  assert.equal(state.cashback.available, 60); assert.equal(state.credits.pending, 250);
});
test('social settings are validated and persist in the public configuration', async () => {
  const settings = (await request('/api/bootstrap')).data.platformSettings;
  assert.equal((await request('/api/admin/settings', { method: 'PUT', cookie: admin, body: { ...settings, contact: { ...settings.contact, x: 'javascript:alert(1)' } } })).status, 400);
  const contact = { email: 'desk@example.test', x: 'https://x.com/apexprofessional', discord: 'https://discord.gg/apexprofessional', instagram: 'https://www.instagram.com/apexprofessional/' };
  assert.equal((await request('/api/admin/settings', { method: 'PUT', cookie: admin, body: { ...settings, contact } })).status, 200);
  assert.deepEqual((await request('/api/bootstrap')).data.platformSettings.contact, contact);
});
test('a member order claim does not prove buyer identity, but a signed order-only refund freezes it', async () => {
  await request('/api/purchases', { method: 'POST', cookie: member, body: { firmId: 'shark-funded', orderId: 'CLAIMED-WITHOUT-PROOF', amount: 100, purchaseDate: new Date().toISOString(), codeUsed: 'APEX-OWNER' } });
  const event = { eventId: 'no-buyer-id-001', orderId: 'CLAIMED-WITHOUT-PROOF', amount: 100, currency: 'USD', status: 'completed', purchasedAt: new Date().toISOString(), couponCode: 'APEX-OWNER' };
  assert.equal((await signEvent(event)).data.matched, false);
  let state = (await request('/api/bootstrap', { cookie: member })).data;
  assert.equal(state.purchases.find((item) => item.orderId === event.orderId).verification, 'unverified');
  assert.equal((await signEvent({ ...event, eventId: 'no-buyer-id-refund-001', status: 'refunded' })).status, 200);
  state = (await request('/api/bootstrap', { cookie: member })).data;
  assert.equal(state.purchases.find((item) => item.orderId === event.orderId).verification, 'refunded');
  assert.equal(state.purchases.find((item) => item.orderId === event.orderId).status, 'rejected');
});
test('new firm publication and archival update the public count without hard-coded totals', async () => {
  const before = (await request('/api/bootstrap')).data.firms;
  const firm = { ...before[0], id: 'new-professional-firm', name: 'New Professional Firm', status: 'active' };
  assert.equal((await request('/api/admin/firms/' + firm.id, { method: 'PUT', cookie: admin, body: firm })).status, 200);
  assert.equal((await request('/api/bootstrap')).data.firms.length, before.length + 1);
  await request('/api/admin/firms/' + firm.id, { method: 'PATCH', cookie: admin, body: { archived: true } });
  assert.equal((await request('/api/bootstrap')).data.firms.length, before.length);
});