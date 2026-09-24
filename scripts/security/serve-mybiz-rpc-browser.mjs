/* global console, process, Request */
import { Buffer } from 'node:buffer';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { createServer as createViteServer } from 'vite';

const statusFile = process.env.LOCAL_SUPABASE_STATUS_FILE;
if (!statusFile) throw new Error('LOCAL_SUPABASE_STATUS_REQUIRED');
const vars = Object.fromEntries(readFileSync(statusFile, 'utf8').split(/\r?\n/)
  .map((line) => line.replace(/^export\s+/, '').match(/^([A-Z_]+)=(.*)$/))
  .filter(Boolean)
  .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]));
const apiUrl = vars.API_URL || vars.SUPABASE_URL;
const anonKey = vars.ANON_KEY || vars.PUBLISHABLE_KEY;
const serviceKey = vars.SERVICE_ROLE_KEY || vars.SECRET_KEY;
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(apiUrl) || !anonKey || !serviceKey) {
  throw new Error('LOCAL_SUPABASE_ONLY');
}
const port = 33162;
process.env.VITE_APP_BASE_URL = `http://127.0.0.1:${port}`;
process.env.VITE_APP_RUNTIME_MODE = 'live';
process.env.VITE_DATA_PROVIDER = 'supabase';
process.env.VITE_SUPABASE_URL = apiUrl;
process.env.VITE_SUPABASE_ANON_KEY = anonKey;
process.env.SUPABASE_URL = apiUrl;
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;

const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
const { default: provision } = await vite.ssrLoadModule('/api/stores/provision.ts');
const { default: publicRoute } = await vite.ssrLoadModule('/api/public.ts');
const { default: setupRequest } = await vite.ssrLoadModule('/api/onboarding/setup-request.ts');
const { default: authSession } = await vite.ssrLoadModule('/api/auth/session.ts');
const server = createServer(async (incoming, outgoing) => {
  const requestUrl = new URL(incoming.url || '/', `http://127.0.0.1:${port}`);
  const pathname = requestUrl.pathname;
  const route = pathname === '/api/stores/provision' ? provision
    : pathname === '/api/public' && requestUrl.searchParams.get('resource') === 'store' ? publicRoute
    : pathname === '/api/onboarding/setup-request' ? setupRequest
      : pathname === '/api/auth/session' ? authSession : null;
  if (!route) {
    if (pathname.startsWith('/api/')) {
      outgoing.writeHead(404, { 'content-type': 'application/json' });
      outgoing.end('{"ok":false,"code":"LOCAL_ROUTE_NOT_IMPLEMENTED"}');
      return;
    }
    vite.middlewares(incoming, outgoing);
    return;
  }
  try {
    const chunks = [];
    for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
    const response = await route(new Request(`http://127.0.0.1:${port}${incoming.url || '/'}`, {
      method: incoming.method, headers: incoming.headers,
      body: chunks.length ? Buffer.concat(chunks) : undefined,
    }));
    outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    outgoing.end(await response.text());
  } catch {
    outgoing.writeHead(500, { 'content-type': 'application/json' });
    outgoing.end('{"ok":false,"code":"LOCAL_ROUTE_FAILED"}');
  }
});
server.listen(port, '127.0.0.1', () => console.log('LOCAL_BROWSER_SERVER_READY'));
process.on('SIGTERM', async () => {
  server.close();
  await vite.close();
});
