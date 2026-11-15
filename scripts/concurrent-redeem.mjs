// Fires N simultaneous redemptions from one member who can afford exactly one.
// Expect: 1 success, N-1 "insufficient credits", balance 0, one debit row.
// The ledger is append-only, so run this ONLY against a disposable development database.
// Usage: DATABASE_URL=postgres://... node scripts/concurrent-redeem.mjs
import pg from "pg";
const N = 8, USER = "99999999-9999-9999-9999-999999999999", REWARD = "99999999-0000-0000-0000-000000000001";
const url = process.env.DATABASE_URL; if (!url) { console.error("DATABASE_URL required"); process.exit(2); }
const admin = new pg.Client({ connectionString: url }); await admin.connect();
await admin.query(`insert into auth.users(id,email,raw_user_meta_data) values ($1,'concurrency@t.dev','{"username":"concurrency_u"}') on conflict do nothing`, [USER]);
await admin.query(`insert into rewards(id,name,currency,credits_cost) values ($1,'Concurrency card','USD',100) on conflict do nothing`, [REWARD]);
await admin.query(`insert into credit_ledger(user_id,type,amount,description,idempotency_key) values ($1,'admin_credit',100,'concurrency seed',$2)`, [USER, "conc-seed-" + Date.now()]);

const attempt = async (i) => {
  const c = new pg.Client({ connectionString: url }); await c.connect();
  try {
    await c.query("begin");
    await c.query(`select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)`, [JSON.stringify({ sub: USER, role: "authenticated" }), USER]);
    await c.query("set local role authenticated");
    await c.query("select redeem_reward($1, $2)", [REWARD, `conc-${Date.now()}-${i}`]);
    await c.query("commit"); return "ok";
  } catch (e) { await c.query("rollback").catch(() => {}); return e.message; } finally { await c.end(); }
};
const results = await Promise.all(Array.from({ length: N }, (_, i) => attempt(i)));
const ok = results.filter((r) => r === "ok").length;
const { rows: [bal] } = await admin.query("select balance from wallet_balance_cache where user_id=$1", [USER]);
const { rows: [debits] } = await admin.query("select count(*)::int c from credit_ledger where user_id=$1 and type='redemption'", [USER]);
console.log({ ok, failures: results.filter((r) => r !== "ok"), balance: Number(bal.balance), debits: debits.c });
await admin.end();
if (ok !== 1 || Number(bal.balance) !== 0 || debits.c !== 1) { console.error("CONCURRENCY TEST FAILED"); process.exit(1); }
console.log("concurrency test passed");
