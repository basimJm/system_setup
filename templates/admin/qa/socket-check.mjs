/**
 * Realtime check against a LOCAL server (see docs/REAL_SERVER_QA.md): connects to the `/admin` namespace the way the
 * panel does (path, namespace, `auth.token`, websocket only), triggers a server event through the public API
 * (`item.updated` after an item patch) and writes every received event name + payload keys to the report. Also
 * checks the handshake refusals (no token, malformed token).
 * Usage: node qa/socket-check.mjs (QA_REPORT=<file>). Never run it against a shared server: it writes data.
 */
import { writeFileSync } from 'node:fs';
import { io } from 'socket.io-client';
import { adminToken, api, BASE } from './lib.mjs';

const PATH = '/socket.io';
/** Not a JWT: the server must refuse it with UNAUTHORIZED. */
const MALFORMED = 'malformed';
const NS = '/admin';
const WAIT_MS = Number(process.env.QA_SOCKET_WAIT_MS ?? 4000);
const out = [];
const received = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Connects and resolves with the socket, or with the connect_error message. */
const open = (auth) =>
  new Promise((resolve) => {
    const s = io(`${BASE}${NS}`, {
      path: PATH,
      transports: ['websocket'],
      auth,
      reconnection: false,
    });
    s.on('connect', () => resolve({ socket: s, error: null }));
    s.on('connect_error', (e) => {
      resolve({ socket: s, error: e.message, active: s.active });
      s.close();
    });
  });

const none = await open({});
out.push(`HANDSHAKE no token -> ${none.error} (active=${String(none.active)})`);
const bad = await open({ token: MALFORMED });
out.push(`HANDSHAKE bad token -> ${bad.error} (active=${String(bad.active)})`);

const token = await adminToken();
const { socket, error } = await open({ token });
out.push(`HANDSHAKE admin token -> ${error ?? 'connected'}`);
socket.onAny((event, payload) => received.push({ event, keys: Object.keys(payload ?? {}).sort() }));

// item.updated: patch the first item (the status it already has, so nothing changes but the audit row).
const first = (await api('admin', 'GET', '/items', undefined, token, '?page=1&pageSize=1'))
  .data?.[0];
if (first) {
  const patch = await api(
    'admin',
    'PATCH',
    `/items/${first.id}`,
    { status: first.status, reason: 'QA socket check' },
    token,
  );
  out.push(`ACTION patch item ${first.id} -> ${String(patch.status)}`);
} else out.push('ACTION patch item -> SKIP (no item; run qa/seed.mjs)');

await sleep(WAIT_MS);
socket.close();
for (const r of received) out.push(`EVENT ${r.event} {${r.keys.join(',')}}`);
writeFileSync(process.env.QA_REPORT ?? 'qa-socket.txt', out.join('\n') + '\n');
console.log('SOCKET-DONE', received.length, 'events');
process.exit(0);
