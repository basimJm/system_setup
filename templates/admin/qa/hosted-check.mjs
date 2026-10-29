/**
 * Unauthenticated wiring check of a HOSTED server (no sign-in, no credentials, creates nothing): health and readiness,
 * the 401/404 envelopes, the CORS preflight for the panel origins, and the `/admin` Socket.IO handshake over websocket
 * (must refuse a missing or malformed token with UNAUTHORIZED, which proves path, namespace and upgrade).
 * Usage: QA_HOSTED=<https base> QA_ORIGINS=<comma list of panel origins> node qa/hosted-check.mjs
 */
import { io } from 'socket.io-client';

const BASE = process.env.QA_HOSTED ?? '';
const ORIGINS = (process.env.QA_ORIGINS ?? '').split(',').filter(Boolean);
const TIMEOUT_MS = Number(process.env.QA_TIMEOUT_MS ?? 90000);
const MALFORMED = 'malformed';
if (!BASE) throw new Error('QA_HOSTED is required');
const out = [];
const status = async (path, init) => {
  const res = await fetch(`${BASE}${path}`, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const body = await res.text();
  return { res, code: body.match(/"code":"(\w+)"/)?.[1] ?? '-' };
};
for (const path of ['/health', '/ready', '/admin/v1/items', '/admin/v1/nope']) {
  const { res, code } = await status(path, { headers: { 'accept-language': 'en' } });
  out.push(`HTTP ${path} -> ${String(res.status)} ${code}`);
}
for (const origin of ORIGINS) {
  const { res } = await status('/admin/v1/auth/login', {
    method: 'OPTIONS',
    headers: {
      origin,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type,authorization,accept-language',
    },
  });
  out.push(
    `CORS ${origin} -> ${String(res.status)} allow-origin=${res.headers.get('access-control-allow-origin') ?? 'none'}`,
  );
}
for (const [label, auth] of [
  ['no token', {}],
  ['malformed token', { token: MALFORMED }],
]) {
  const result = await new Promise((resolve) => {
    const s = io(`${BASE}/admin`, {
      path: '/socket.io',
      transports: ['websocket'],
      auth,
      reconnection: false,
      timeout: TIMEOUT_MS,
    });
    s.on('connect', () => {
      resolve('connected');
      s.close();
    });
    s.on('connect_error', (e) => {
      resolve(`${e.message} (active=${String(s.active)})`);
      s.close();
    });
  });
  out.push(`SOCKET /admin ${label} -> ${result}`);
}
console.log(out.join('\n'));
process.exit(0);
