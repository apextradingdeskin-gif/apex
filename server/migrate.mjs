import 'dotenv/config';
import { openPostgresStore } from './postgres-store.mjs';
import { seedPayoutMethods } from './payout-methods.mjs';
if (!process.env.SUPABASE_DB_URL) {
  console.error('Set SUPABASE_DB_URL privately using the connection string from Supabase > Connect. Do not paste credentials into the website or chat.');
  process.exitCode = 1;
} else {
  let store;
  try {
    store = await openPostgresStore(process.env.SUPABASE_DB_URL);
    await seedPayoutMethods(store);
    console.log('Supabase Postgres migration completed. Private schema and RLS are enabled.');
  } catch (error) {
    console.error('Migration failed:', String(error.message).replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[redacted connection]'));
    process.exitCode = 1;
  } finally { if (store) await store.db.close(); }
}