import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { asyncSqlite } from './async-sqlite.mjs';
import { attachRecordStore } from './store-helpers.mjs';

export const catalog = JSON.parse(readFileSync(new URL('./catalog.json', import.meta.url), 'utf8'));
export const defaultSettings = {
  creditRate: 1, minPayout: 25, reviewModeration: false, cashbackEnabled: true,
  announcement: 'Research the rules. Compare the value. Trade your plan.', siteLogo: '',
  contact: { email: 'apextradingdesk.in@gmail.com', x: 'https://x.com/apexXtrades', discord: 'https://discord.gg/fgkSY352aT', instagram: 'https://www.instagram.com/apexxdesk/' },
};

export function openDatabase(filename = process.env.DATABASE_PATH || resolve('data/apex.sqlite')) {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true, mode: 0o700 });
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL, password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin')),
      suspended INTEGER NOT NULL DEFAULT 0,
      referral_code TEXT NOT NULL UNIQUE, referred_by TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS firms (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id = 1), data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY, content BLOB NOT NULL, mime TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS conversions (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS partner_keys (firm_id TEXT PRIMARY KEY REFERENCES firms(id), secret TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS payout_methods (id TEXT PRIMARY KEY, data TEXT NOT NULL);
  `);
  for (const table of ['purchases', 'reviews', 'redemptions', 'clicks', 'payouts']) {
    db.exec(`CREATE TABLE IF NOT EXISTS ${table} (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), data TEXT NOT NULL
    ); CREATE INDEX IF NOT EXISTS idx_${table}_user ON ${table}(user_id);`);
  }
  db.prepare('INSERT OR IGNORE INTO settings(id, data) VALUES(1, ?)').run(JSON.stringify(defaultSettings));
  db.transaction(() => {
    const insert = db.prepare('INSERT OR IGNORE INTO firms(id, data) VALUES(?, ?)');
    for (const firm of catalog.firms) insert.run(firm.id, JSON.stringify(firm));
  })();
  return attachRecordStore(asyncSqlite(db), defaultSettings, 'sqlite');
}

export async function openStore(options = {}) {
  if (options.databasePath || options.local) return openDatabase(options.databasePath);
  const mode = (process.env.DATA_BACKEND || 'sqlite').trim().toLowerCase();
  if (!['sqlite', 'supabase'].includes(mode)) throw Object.assign(new Error('Invalid DATA_BACKEND.'), { code: 'INVALID_DATA_BACKEND' });
  if (mode === 'sqlite') return openDatabase(options.databasePath);
  const connection = process.env.SUPABASE_DB_URL;
  if (!connection) throw new Error('Supabase mode requires SUPABASE_DB_URL from Dashboard > Connect. Set it privately on the server; an API key is not a database connection string.');
  const { openPostgresStore } = await import('./postgres-store.mjs');
  return openPostgresStore(connection);
}

export function publicUser(row) {
  return {
    id: row.id, name: row.name, email: row.email, role: row.role,
    suspended: Boolean(row.suspended), referralCode: row.referral_code,
    referredBy: row.referred_by || undefined, createdAt: row.created_at,
  };
}