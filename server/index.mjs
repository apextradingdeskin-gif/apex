import 'dotenv/config';
import express from 'express';
import { resolve } from 'node:path';
import { createApp } from './app.mjs';
import { diagnoseStartup, safeServerMessage } from './diagnostics.mjs';
const production = process.argv.includes('--production') || process.env.NODE_ENV === 'production';
let app, store;
try { ({ app, store } = await createApp({ production })); }
catch (error) {
    const info = diagnoseStartup(error);
    console.error(`APEX account server did not start [${info.code}].\n${info.message}\n${info.action}\nRun npm run doctor for a secret-safe connection report.`);
    if (info.code === 'SERVER_INITIALIZATION_FAILED') console.error(safeServerMessage(error.message));
    process.exit(1);
}
let vite;
if (!production) {
    const { createServer } = await import('vite');
    vite = await createServer({ server: {
            middlewareMode: true,
            fs: { deny: ['**/.env', '**/.env.*', '**/*.{crt,pem}', '**/.git/**', '**/data/**', '**/server/**', '**/*.sqlite*'] },
        }, appType: 'spa' });
    app.use(vite.middlewares);
}
else {
    app.use(express.static(resolve('dist'), { index: false }));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
}
const portArgument = process.argv.indexOf('--port');
const port = Number(process.env.PORT || (portArgument >= 0 ? process.argv[portArgument + 1] : '') || (process.argv.includes('--preview') ? 4173 : 5173));
const server = app.listen(port, '0.0.0.0', () => console.log(`APEX website + API: http://localhost:${port} (${production ? 'production' : 'development'})`));
server.on('error', async (error) => {
    console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Stop the old frontend/Vite server, then restart npm run dev, or choose a different PORT. Open the URL printed by the integrated server.` : `Web server could not listen: ${safeServerMessage(error.message)}`);
    if (vite) await vite.close();
    await store.db.close(); process.exit(1);
});
const shutdown = async () => { server.close(); if (vite)
    await vite.close(); await store.db.close(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
