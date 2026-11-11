-- Server-owned application data. The website never connects to these tables with a public key.
CREATE SCHEMA IF NOT EXISTS apex_private;
REVOKE ALL ON SCHEMA apex_private FROM PUBLIC;

CREATE TABLE IF NOT EXISTS apex_private.users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  suspended INTEGER NOT NULL DEFAULT 0 CHECK (suspended IN (0,1)),
  referral_code TEXT NOT NULL UNIQUE, referred_by TEXT, created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS apex_users_email_lower ON apex_private.users(lower(email));
CREATE TABLE IF NOT EXISTS apex_private.sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES apex_private.users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS apex_session_expiry ON apex_private.sessions(expires_at);
CREATE TABLE IF NOT EXISTS apex_private.settings (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS apex_private.app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS apex_private.firms (id TEXT PRIMARY KEY, data TEXT NOT NULL, sort_order BIGSERIAL NOT NULL);
CREATE TABLE IF NOT EXISTS apex_private.audit (id TEXT PRIMARY KEY, data TEXT NOT NULL, sort_order BIGSERIAL NOT NULL);
CREATE TABLE IF NOT EXISTS apex_private.conversions (id TEXT PRIMARY KEY, data TEXT NOT NULL, sort_order BIGSERIAL NOT NULL);
CREATE TABLE IF NOT EXISTS apex_private.payout_methods (id TEXT PRIMARY KEY, data TEXT NOT NULL, sort_order BIGSERIAL NOT NULL);
CREATE TABLE IF NOT EXISTS apex_private.media (id TEXT PRIMARY KEY, content BYTEA NOT NULL, mime TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS apex_private.partner_keys (
  firm_id TEXT PRIMARY KEY REFERENCES apex_private.firms(id), secret TEXT NOT NULL, created_at TEXT NOT NULL
);

DO $migration$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['purchases','reviews','redemptions','clicks','payouts'] LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS apex_private.%I (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES apex_private.users(id), data TEXT NOT NULL, sort_order BIGSERIAL NOT NULL)', table_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON apex_private.%I(user_id)', 'apex_' || table_name || '_user', table_name);
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['users','sessions','settings','app_meta','firms','audit','conversions','payout_methods','media','partner_keys','purchases','reviews','redemptions','clicks','payouts'] LOOP
    EXECUTE format('ALTER TABLE apex_private.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON apex_private.%I FROM PUBLIC', table_name);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
      EXECUTE format('REVOKE ALL ON apex_private.%I FROM anon', table_name);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
      EXECUTE format('REVOKE ALL ON apex_private.%I FROM authenticated', table_name);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON SCHEMA apex_private FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON SCHEMA apex_private FROM authenticated;
  END IF;
END;
$migration$;