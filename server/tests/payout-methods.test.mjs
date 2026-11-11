import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createApp } from '../app.mjs';

const directory = mkdtempSync(join(tmpdir(), 'apex-methods-'));
const databasePath = join(directory, 'methods.sqlite');
const password = 'Methods-test-password-2026!';
let app, store, server, base, admin, member, memberId, wise, payoutId;
async function request(path, method = 'GET', body, cookie) {
  const response = await fetch(base + path, { method, headers: { 'X-Apex-Client': 'web', ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
before(async () => {
  execFileSync(process.execPath, ['server/create-admin.mjs', '--local'], { env: { ...process.env, DATABASE_PATH: databasePath, APEX_ADMIN_EMAIL: 'methods-owner@example.test', APEX_ADMIN_PASSWORD: password } });
  ({ app, store } = await createApp({ databasePath, production: false }));
  server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`;
  admin = (await request('/api/auth/admin-login', 'POST', { email: 'methods-owner@example.test', password })).cookie;
  const registration = await request('/api/auth/register', 'POST', { name: 'Methods Member', email: 'methods-member@example.test', password });
  member = registration.cookie; memberId = registration.data.user.id;
  await request('/api/purchases', 'POST', { firmId: 'shark-funded', orderId: 'METHODS-ORDER', amount: 1000, purchaseDate: new Date().toISOString() }, member);
  const purchase = (await request('/api/admin/state', 'GET', undefined, admin)).data.allPurchases[0];
  await request('/api/admin/purchases/' + purchase.id, 'PATCH', { status: 'approved', adminNote: 'Verified method test invoice' }, admin);
});
after(async () => { await new Promise((resolve) => server.close(resolve)); await store.db.close(); rmSync(directory, { recursive: true, force: true }); });

test('each default payout method has its own questions and members cannot edit methods', async () => {
  const methods = (await request('/api/bootstrap', 'GET', undefined, member)).data.payoutMethods;
  assert.deepEqual(methods.map((item) => item.id), ['paypal', 'upi', 'bank-transfer']);
  assert.ok(methods.find((item) => item.id === 'paypal').questions.some((item) => item.type === 'email'));
  assert.ok(methods.find((item) => item.id === 'upi').questions.some((item) => item.validation === 'upi'));
  assert.ok(methods.find((item) => item.id === 'bank-transfer').questions.some((item) => item.id === 'account_number'));
  assert.equal((await request('/api/admin/payout-methods/paypal', 'PUT', methods[0], member)).status, 403);
});
test('admins create custom methods and questions without allowing credential-collection prompts', async () => {
  const definition = { id: 'wise', name: 'Wise', description: 'Wise account payout', instructions: 'Use your Wise account email.', status: 'active', minimum: 50, currency: 'USD', order: 4, questions: [
    { id: 'name', label: 'Recipient full name', type: 'text', required: true, purpose: 'payee' },
    { id: 'email', label: 'Wise account email', type: 'email', required: true, validation: 'email', purpose: 'destination', sensitive: true },
    { id: 'account_type', label: 'Account type', type: 'select', required: true, options: ['Personal', 'Business'] },
  ] };
  assert.equal((await request('/api/admin/payout-methods/wise', 'PUT', { ...definition, questions: [{ id: 'bad', label: 'Bank password', type: 'text', required: true }] }, admin)).status, 400);
  assert.equal((await request('/api/admin/payout-methods/wise', 'PUT', definition, admin)).status, 200);
  wise = (await request('/api/bootstrap')).data.payoutMethods.find((item) => item.id === 'wise');
  assert.equal(wise.version, 1);
});
test('method-specific required questions, choices, email and minimum are checked on the server', async () => {
  const baseInput = { amount: 50, methodId: 'wise', methodVersion: wise.version, requestKey: randomUUID(), answers: { name: 'Methods Member', email: 'wise-private@example.test', account_type: 'Personal' } };
  assert.equal((await request('/api/payouts', 'POST', { ...baseInput, amount: 25 }, member)).status, 400);
  assert.equal((await request('/api/payouts', 'POST', { ...baseInput, answers: { name: 'Methods Member', email: 'invalid', account_type: 'Personal' } }, member)).status, 400);
  assert.equal((await request('/api/payouts', 'POST', { ...baseInput, answers: { ...baseInput.answers, account_type: 'Unknown' } }, member)).status, 400);
  assert.equal((await request('/api/payouts', 'POST', { ...baseInput, answers: { name: 'Methods Member', email: 'wise-private@example.test' } }, member)).status, 400);
  assert.equal((await request('/api/payouts', 'POST', baseInput, member)).status, 201);
  const snapshot = (await request('/api/bootstrap', 'GET', undefined, member)).data;
  const payout = snapshot.payouts[0]; payoutId = payout.id;
  assert.equal(payout.method, 'Wise'); assert.equal(payout.encryptedAnswers, undefined); assert.equal(payout.answers, undefined); assert.equal(payout.fingerprint, undefined);
  assert.equal(JSON.stringify(snapshot).includes('wise-private@example.test'), false);
  const raw = (await store.list('payouts'))[0]; assert.ok(raw.encryptedAnswers); assert.equal(JSON.stringify(raw).includes('wise-private@example.test'), false);
  assert.equal((await request('/api/admin/payouts/' + payoutId + '/details', 'GET', undefined, member)).status, 403);
  const privateDetails = (await request('/api/admin/payouts/' + payoutId + '/details', 'GET', undefined, admin)).data;
  assert.equal(privateDetails.answers.email, 'wise-private@example.test');
});
test('method editing preserves historical questions and rejects stale member forms', async () => {
  assert.equal((await request('/api/admin/payout-methods/wise', 'PUT', { ...wise, questions: wise.questions.map((item, index) => index ? item : { ...item, label: 'Updated name question' }) }, admin)).status, 200);
  const historical = (await request('/api/admin/payouts/' + payoutId + '/details', 'GET', undefined, admin)).data;
  assert.equal(historical.methodSnapshot.questions[0].label, 'Recipient full name');
  assert.equal((await request('/api/payouts', 'POST', { amount: 50, methodId: 'wise', methodVersion: 1, requestKey: randomUUID(), answers: { name: 'Methods Member', email: 'wise-private@example.test', account_type: 'Personal' } }, member)).status, 409);
  assert.equal((await request('/api/admin/payout-methods/wise', 'PUT', wise, admin)).status, 409);
  wise = (await request('/api/admin/state', 'GET', undefined, admin)).data.payoutMethods.find((item) => item.id === 'wise');
});
test('retired methods reject new requests; deletion preserves history and does not reseed removed defaults', async () => {
  assert.equal((await request('/api/admin/payout-methods/wise', 'PUT', { ...wise, status: 'retired' }, admin)).status, 200);
  assert.equal((await request('/api/bootstrap')).data.payoutMethods.some((item) => item.id === 'wise'), false);
  assert.equal((await request('/api/admin/payout-methods/wise', 'DELETE', undefined, admin)).status, 409);
  await request('/api/payouts/' + payoutId, 'DELETE', undefined, member);
  assert.equal((await request('/api/admin/payout-methods/wise', 'DELETE', undefined, admin)).status, 200);
  assert.equal((await request('/api/bootstrap', 'GET', undefined, member)).data.payouts[0].methodSnapshot.name, 'Wise');
  const paypal = (await request('/api/admin/state', 'GET', undefined, admin)).data.payoutMethods.find((item) => item.id === 'paypal');
  await request('/api/admin/payout-methods/paypal', 'PUT', { ...paypal, status: 'retired' }, admin);
  assert.equal((await request('/api/admin/payout-methods/paypal', 'DELETE', undefined, admin)).status, 200);
  await new Promise((resolve) => server.close(resolve)); await store.db.close();
  ({ app, store } = await createApp({ databasePath, production: false })); server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await request('/api/bootstrap')).data.payoutMethods.some((item) => item.id === 'paypal'), false);
  assert.equal((await request('/api/admin/payouts/' + payoutId + '/details', 'GET', undefined, admin)).data.answers.email, 'wise-private@example.test');
});
test('unsuspending restores sign-in but never revives previously revoked sessions', async () => {
  assert.equal((await request('/api/admin/members/' + memberId, 'PATCH', { role: 'member', suspended: true }, admin)).status, 200);
  assert.equal((await request('/api/bootstrap', 'GET', undefined, member)).data.user, null);
  assert.equal((await request('/api/auth/login', 'POST', { email: 'methods-member@example.test', password })).status, 403);
  assert.equal((await request('/api/admin/members/' + memberId, 'PATCH', { role: 'member', suspended: false }, admin)).status, 200);
  assert.equal((await request('/api/bootstrap', 'GET', undefined, member)).data.user, null);
  const restored = await request('/api/auth/login', 'POST', { email: 'methods-member@example.test', password });
  assert.equal(restored.status, 200); assert.equal(restored.data.user.role, 'member');
});