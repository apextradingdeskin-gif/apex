export function safeServerMessage(value) {
  return String(value ?? '').replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[redacted database connection]').replace(/sb_secret_[a-zA-Z0-9_-]+/g, '[redacted secret]');
}

export function diagnoseStartup(error) {
  const code = error?.code;
  const message = String(error?.message ?? '');
  if (code === 'INVALID_DATA_BACKEND') return { code, message: 'DATA_BACKEND must be sqlite or supabase.', action: 'Correct the value in the private server environment and restart.' };
  if (/SUPABASE_DB_URL/.test(message)) return { code: 'SUPABASE_DATABASE_NOT_CONFIGURED', message: 'Supabase database mode is selected, but its server connection string is missing.', action: 'Set SUPABASE_DB_URL from Supabase > Connect > Session pooler. An API key is not a database password.' };
  if (/DATA_ENCRYPTION_KEY|encryption key is invalid/i.test(message)) return { code: 'ENCRYPTION_KEY_NOT_CONFIGURED', message: 'The payout encryption key is missing or invalid.', action: 'Configure the persistent 64-character hexadecimal DATA_ENCRYPTION_KEY. Restore the existing key for an existing database; do not replace it with a new key.' };
  if (/authenticate data|bad decrypt/i.test(message)) return { code: 'PAYOUT_KEY_MISMATCH', message: 'The saved payment details cannot be unlocked with the current key.', action: 'Restore the original payout encryption key or local payout-key file. Do not delete the database.' };
  if (['28P01', '28000'].includes(code)) return { code: 'DATABASE_LOGIN_FAILED', message: 'The server could not authenticate to Postgres.', action: 'Check the database username and database password in SUPABASE_DB_URL, not the publishable/secret API keys.' };
  if (['42501', '42P01', '3F000'].includes(code)) return { code: 'DATABASE_SETUP_REQUIRED', message: 'The account database schema or permissions are not ready.', action: 'Check the server database account, then run npm run db:migrate using the configured Supabase connection.' };
  if (['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ETIMEDOUT', 'ENETUNREACH'].includes(code) || /connection.*timeout|timeout.*connect/i.test(message)) return { code: 'DATABASE_UNREACHABLE', message: 'The configured account database cannot be reached.', action: 'Check the connection host, network access and Supabase project status. Copy the exact pooler host from the Connect dialog.' };
  if (/certificate|self.signed|CERT_/i.test(`${code} ${message}`)) return { code: 'DATABASE_TLS_FAILED', message: 'Postgres TLS verification failed.', action: 'Configure SUPABASE_CA_FILE using the project root certificate. Do not disable certificate verification for Supabase.' };
  if (['EACCES', 'EPERM', 'SQLITE_CANTOPEN', 'SQLITE_READONLY'].includes(code)) return { code: 'DATABASE_STORAGE_NOT_WRITABLE', message: 'The server cannot access its private local data directory.', action: 'Give the Node process access to DATABASE_PATH and its payout-key file, or configure the intended Supabase backend.' };
  return { code: 'SERVER_INITIALIZATION_FAILED', message: 'The APEX account server could not start.', action: 'Run npm run doctor and inspect the private server terminal. Verify dependencies and database configuration.' };
}

export function databaseFailure(error) {
  const info = diagnoseStartup(error);
  return info.code !== 'SERVER_INITIALIZATION_FAILED' && info.code !== 'INVALID_DATA_BACKEND' ? info : null;
}