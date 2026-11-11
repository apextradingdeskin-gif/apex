import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createApp } from '../app.mjs';
import { diagnoseStartup, safeServerMessage } from '../diagnostics.mjs';

test('startup diagnostics distinguish configuration, network and database login problems without secrets', () => {
  assert.equal(diagnoseStartup(new Error('Supabase mode requires SUPABASE_DB_URL')).code, 'SUPABASE_DATABASE_NOT_CONFIGURED');
  assert.equal(diagnoseStartup(new Error('DATA_ENCRYPTION_KEY must be 64 hexadecimal characters.')).code, 'ENCRYPTION_KEY_NOT_CONFIGURED');
  assert.equal(diagnoseStartup(new Error('Unsupported state or unable to authenticate data')).code, 'PAYOUT_KEY_MISMATCH');
  assert.equal(diagnoseStartup({ code: '28P01', message: 'Authentication failure' }).code, 'DATABASE_LOGIN_FAILED');
  assert.equal(diagnoseStartup({ code: 'ENOTFOUND' }).code, 'DATABASE_UNREACHABLE');
  assert.equal(diagnoseStartup({ code: '42501' }).code, 'DATABASE_SETUP_REQUIRED');
  const redacted = safeServerMessage('Failure postgres://private-user:private-password@host/database and sb_secret_test_placeholder_12345');
  assert.doesNotMatch(redacted, /private-password|sb_secret_test/);
});

test('API health tests the actual database and the doctor recognises the combined server', async () => {
  const { app, store } = await createApp({ databasePath: ':memory:', production: false });
  const server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let closed = false;
  try {
    const response = await fetch(origin + '/api/health', { headers: { Cookie: 'apex_session=' + '1'.repeat(64) } });
    const health = await response.json();
    assert.equal(response.status, 200); assert.equal(health.service, 'apex-account-api'); assert.equal(health.ready, true);
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['server/doctor.mjs', '--url', origin, '--json'], { env: { ...process.env, DATA_BACKEND: 'sqlite' } });
      let output = ''; let stderr = ''; child.stdout.on('data', (part) => { output += part; }); child.stderr.on('data', (part) => { stderr += part; });
      child.on('error', reject); child.on('close', (code) => resolve({ code, output, stderr }));
    });
    assert.equal(result.code, 0, result.stderr || result.output);
    assert.equal(JSON.parse(result.output).ready, true);
    await store.db.close(); closed = true;
    const unavailable = await fetch(origin + '/api/health'); const failure = await unavailable.json();
    assert.equal(unavailable.status, 503); assert.equal(failure.ready, false); assert.equal(failure.service, 'apex-account-api');
  } finally { await new Promise((resolve) => server.close(resolve)); if (!closed) await store.db.close(); }
});

test('missing Supabase configuration produces an actionable startup error instead of an uncaught stack', async () => {
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, DATA_BACKEND: 'supabase', SUPABASE_DB_URL: '' } });
    let stderr = ''; child.stderr.on('data', (part) => { stderr += part; }); child.stdout.resume();
    child.on('error', reject); child.on('close', (code) => resolve({ code, stderr }));
  });
  assert.equal(result.code, 1); assert.match(result.stderr, /SUPABASE_DATABASE_NOT_CONFIGURED/); assert.match(result.stderr, /npm run doctor/);
  assert.doesNotMatch(result.stderr, /at createApp|at openStore|sb_secret_/);
});