import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync } from 'node:fs';
import { catalog, defaultSettings } from './database.mjs';
import { attachRecordStore } from './store-helpers.mjs';

const tables = new Set(['users','sessions','settings','app_meta','firms','audit','conversions','payout_methods','media','partner_keys','purchases','reviews','redemptions','clicks','payouts']);
export function postgresSql(sql) {
  let parameter = 0;
  return sql.replace(/\?/g, () => `$${++parameter}`).replace(/\browid\b/gi, 'sort_order')
    .replace(/\b(FROM|JOIN|UPDATE|INTO)\s+([a-z_]+)/gi, (match, prefix, table) => tables.has(table.toLowerCase()) ? `${prefix} apex_private.${table}` : match);
}

export async function openPostgresStore(connectionString, options = {}) {
  let pool = options.pool;
  if (!pool) {
    const url = new URL(connectionString);
    const local = ['localhost','127.0.0.1','::1'].includes(url.hostname);
    url.searchParams.delete('sslmode');
    const ssl = local && process.env.PGSSL === 'disable' ? false : {
      rejectUnauthorized: true,
      ...(process.env.SUPABASE_CA_FILE ? { ca: readFileSync(process.env.SUPABASE_CA_FILE, 'utf8') } : {}),
    };
    pool = new pg.Pool({ connectionString: url.toString(), max: 5, ssl, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 });
  }
  const migration = readFileSync(new URL('../supabase/migrations/202611110001_apex_private.sql', import.meta.url), 'utf8');
  try {
  await pool.query(migration);
  const scope = new AsyncLocalStorage();
  const query = (sql, values = []) => (scope.getStore() ?? pool).query(postgresSql(sql), values);
  const db = {
    prepare(sql) {
      return {
        all: async (...values) => (await query(sql, values)).rows,
        get: async (...values) => (await query(sql, values)).rows[0],
        run: async (...values) => ({ changes: (await query(sql, values)).rowCount }),
      };
    },
    transaction(callback) {
      return async (...args) => {
        if (scope.getStore()) return callback(...args);
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          // Serializes financial read/check/write operations across backend instances.
          await client.query('SELECT pg_advisory_xact_lock(724106311)');
          const result = await scope.run(client, () => callback(...args));
          await client.query('COMMIT'); return result;
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
      };
    },
    close: () => pool.end(),
  };
  await db.prepare('INSERT INTO settings(id,data) VALUES(1,?) ON CONFLICT(id) DO NOTHING').run(JSON.stringify(defaultSettings));
  for (const firm of catalog.firms) await db.prepare('INSERT INTO firms(id,data) VALUES(?,?) ON CONFLICT(id) DO NOTHING').run(firm.id, JSON.stringify(firm));
  return attachRecordStore(db, defaultSettings, 'supabase-postgres');
  } catch (error) { await pool.end(); throw error; }
}