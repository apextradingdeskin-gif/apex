import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { openStore } from './database.mjs';
import { hashPassword } from './security.mjs';
const rl = createInterface({ input: stdin, output: stdout });
try {
    const email = (process.env.APEX_ADMIN_EMAIL || await rl.question('Administrator email: ')).trim().toLowerCase();
    const name = process.env.APEX_ADMIN_NAME || 'APEX Administrator';
    // Prefer an environment variable to keep the password out of shell history.
    const password = process.env.APEX_ADMIN_PASSWORD || await rl.question('Administrator password (12+ characters, visible input): ');
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 12 || password.length > 128)
        throw new Error('Use a valid email and a password of 12-128 characters.');
    const { db } = await openStore({ local: process.argv.includes('--local') });
    try {
        const passwordHash = await hashPassword(password);
        const existing = await db.prepare('SELECT id FROM users WHERE email=?').get(email);
        if (existing) {
            await db.prepare("UPDATE users SET password_hash=?,role='admin',suspended=0 WHERE id=?").run(passwordHash, existing.id);
            await db.prepare('DELETE FROM sessions WHERE user_id=?').run(existing.id);
        }
        else {
            await db.prepare("INSERT INTO users(id,email,name,password_hash,role,referral_code,created_at) VALUES(?,?,?,?, 'admin',?,?)").run(randomUUID(), email, name, passwordHash, `APX-${randomBytes(3).toString('hex').toUpperCase()}`, new Date().toISOString());
        }
        console.log(`Administrator provisioned: ${email}. Sign in at /admin. No public setup endpoint exists.`);
    }
    finally {
        await db.close();
    }
}
catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
finally {
    rl.close();
}
