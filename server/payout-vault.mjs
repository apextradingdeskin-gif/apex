import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function createPayoutVault(options, kind) {
  const configured = options.encryptionKey ?? process.env.DATA_ENCRYPTION_KEY;
  let key;
  if (configured) {
    if (!/^[a-f0-9]{64}$/i.test(configured)) throw new Error('DATA_ENCRYPTION_KEY must be 64 hexadecimal characters.');
    key = Buffer.from(configured, 'hex');
  } else if (kind === 'supabase-postgres') {
    throw new Error('Supabase storage requires a persistent server-only DATA_ENCRYPTION_KEY for payout details.');
  } else if (options.databasePath === ':memory:') key = randomBytes(32);
  else {
    const file = resolve(`${options.databasePath || process.env.DATABASE_PATH || 'data/apex.sqlite'}.payout-key`);
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    if (!existsSync(file)) writeFileSync(file, randomBytes(32), { mode: 0o600, flag: 'wx' });
    key = readFileSync(file);
    if (key.length !== 32) throw new Error('The local payout encryption key is invalid.');
  }
  const seal = (data) => {
    const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv);
    const content = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
    return { version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), content: content.toString('base64') };
  };
  const open = (data) => {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(data.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(data.tag, 'base64'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data.content, 'base64')), decipher.final()]).toString('utf8'));
  };
  const publicRow = (item) => { const { encryptedAnswers, answers, fingerprint, ...safe } = item; return safe; };
  return { seal, open, publicRow, environmentKey: Boolean(configured) };
}

export async function migrateLegacyPayouts(store, vault) {
  await store.db.transaction(async () => {
    for (const item of await store.list('payouts')) {
      if (item.encryptedAnswers) { vault.open(item.encryptedAnswers); continue; }
      const answers = { payee_name: item.payeeName || '', legacy_destination: item.destination || '' };
      await store.put('payouts', {
        ...item, destination: item.destination ? `Ending ${item.destination.slice(-4)}` : 'Details provided',
        encryptedAnswers: vault.seal(answers),
        methodSnapshot: item.methodSnapshot ?? { name: item.method, questions: [
          { id: 'payee_name', label: 'Account holder / payee name', type: 'text', required: true, sensitive: false },
          { id: 'legacy_destination', label: 'Previously supplied payout details', type: 'text', required: true, sensitive: true },
        ] },
      });
    }
  })();
}