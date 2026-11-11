export const recordTables = new Set(['firms', 'purchases', 'reviews', 'redemptions', 'clicks', 'audit', 'payouts', 'conversions', 'payout_methods']);
const independent = new Set(['firms', 'audit', 'conversions', 'payout_methods']);

export function attachRecordStore(db, defaults, kind) {
  const name = (table) => { if (!recordTables.has(table)) throw new Error('Unknown record table'); return table; };
  const list = async (table, userId) => {
    const rows = await db.prepare(`SELECT data FROM ${name(table)} ${userId ? 'WHERE user_id = ?' : ''} ORDER BY rowid DESC`).all(...(userId ? [userId] : []));
    return rows.map((row) => JSON.parse(row.data));
  };
  const get = async (table, id) => { const row = await db.prepare(`SELECT data FROM ${name(table)} WHERE id = ?`).get(id); return row ? JSON.parse(row.data) : null; };
  const put = async (table, item) => {
    const sql = independent.has(table)
      ? `INSERT INTO ${name(table)}(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`
      : `INSERT INTO ${name(table)}(id,user_id,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`;
    await db.prepare(sql).run(...(independent.has(table) ? [item.id, JSON.stringify(item)] : [item.id, item.userId, JSON.stringify(item)]));
  };
  const remove = async (table, id) => db.prepare(`DELETE FROM ${name(table)} WHERE id = ?`).run(id);
  const settings = async () => {
    const row = await db.prepare('SELECT data FROM settings WHERE id = 1').get();
    const saved = row ? JSON.parse(row.data) : {};
    return { ...defaults, ...saved, contact: { ...defaults.contact, ...saved.contact } };
  };
  return { db, list, get, put, remove, settings, kind };
}