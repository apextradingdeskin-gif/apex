// Disposable database and credentials used only by Playwright, never by npm run dev.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const directory = mkdtempSync(join(tmpdir(), 'apex-browser-'));
process.env.DATABASE_PATH = join(directory, 'browser.sqlite');
process.env.DATA_BACKEND = 'sqlite';
process.env.PORT = '5187';
process.env.PUBLIC_ORIGIN = 'http://127.0.0.1:5187';
execFileSync(process.execPath, ['server/create-admin.mjs', '--local'], { env: { ...process.env, APEX_ADMIN_EMAIL: 'browser-owner@example.test', APEX_ADMIN_PASSWORD: 'Browser-test-owner-2026!', APEX_ADMIN_NAME: 'Browser Owner' } });
process.on('exit', () => rmSync(directory, { recursive: true, force: true }));
await import('./index.mjs');