import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Redis } from 'ioredis';
import { io as connect, type Socket as ClientSocket } from 'socket.io-client';
import { signAccessToken } from '../src/utils/auth/accessToken';
import { createLogger } from '../src/utils/logger';
import { connectRedis, disconnectRedis } from '../src/utils/redis/client';
import { createSocketServer, type SocketHub } from '../src/sockets/socketServer';
import { startTestRedis, type TestRedis } from './helpers/redis';

const logger = createLogger({ level: 'silent' });
const SECRET = 'a'.repeat(48);
const ID = '65a000000000000000000001';
let testRedis: TestRedis;
let redis: Redis;
const servers: { http: Server; hub: SocketHub }[] = [];
const clients: ClientSocket[] = [];

const start = async (
  onConnection?: Parameters<typeof createSocketServer>[0]['onConnection'],
  now?: () => Date,
): Promise<{ url: string; hub: SocketHub }> => {
  const http = createServer();
  await new Promise<void>((resolve) => http.listen(0, resolve));
  const hub = createSocketServer({
    httpServer: http,
    redis,
    accessSecret: SECRET,
    corsAllowedOrigins: [],
    logger,
    ...(onConnection === undefined ? {} : { onConnection }),
    ...(now === undefined ? {} : { now }),
  });
  servers.push({ http, hub });
  return { url: `http://127.0.0.1:${String((http.address() as AddressInfo).port)}`, hub };
};
const token = (subjectType: 'CUSTOMER' | 'MEMBER' | 'ADMIN', ttlSec = 600, id = ID): string =>
  signAccessToken({ secret: SECRET, subjectType, subjectId: id, ttlSec }).token;
const open = (
  url: string,
  namespace: string,
  auth?: object,
  headers?: Record<string, string>,
): ClientSocket => {
  const client = connect(`${url}${namespace}`, {
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
    ...(auth === undefined ? {} : { auth }),
    ...(headers === undefined ? {} : { extraHeaders: headers }),
  });
  clients.push(client);
  return client;
};
const connected = (client: ClientSocket): Promise<void> =>
  new Promise((resolve, reject) => {
    client.once('connect', resolve);
    client.once('connect_error', reject);
  });
const rejectedWith = async (client: ClientSocket): Promise<string> => {
  try {
    await connected(client);
  } catch (error) {
    return (error as { data?: { code?: string } }).data?.code ?? '';
  }
  return 'CONNECTED';
};
const nextEvent = (client: ClientSocket, event: string): Promise<unknown> =>
  new Promise((resolve) => client.once(event, resolve));

jest.setTimeout(20_000);

/** Repeats `action` until `done` settles: the Redis adapter subscribes asynchronously after start. */
const repeatUntil = async <T>(done: Promise<T>, action: () => void): Promise<T> => {
  const timer = setInterval(action, 50);
  try {
    action();
    return await done;
  } finally {
    clearInterval(timer);
  }
};

beforeAll(async () => {
  testRedis = await startTestRedis();
  redis = await connectRedis({ redis: { url: testRedis.url } }, logger);
});
afterEach(async () => {
  for (const client of clients.splice(0)) client.close();
  for (const { http, hub } of servers.splice(0)) {
    await hub.close();
    await new Promise((resolve) => http.close(resolve));
  }
});
afterAll(async () => {
  await disconnectRedis(redis);
  await testRedis.stop();
});

describe('handshake', () => {
  it('accepts a token of the namespace’s scope in auth or the Authorization header', async () => {
    const { url } = await start();
    await connected(open(url, '/customer', { token: token('CUSTOMER') }));
    await connected(open(url, '/merchant', {}, { authorization: `Bearer ${token('MEMBER')}` }));
    await connected(open(url, '/admin', { token: token('ADMIN') }));
  });
  it('refuses a missing, malformed, expired or foreign-secret token with UNAUTHORIZED', async () => {
    const { url } = await start();
    expect(await rejectedWith(open(url, '/customer'))).toBe('UNAUTHORIZED');
    expect(await rejectedWith(open(url, '/customer', { token: 'nope' }))).toBe('UNAUTHORIZED');
    expect(await rejectedWith(open(url, '/customer', { token: 12 }))).toBe('UNAUTHORIZED');
    const other = signAccessToken({
      secret: 'b'.repeat(48),
      subjectType: 'CUSTOMER',
      subjectId: ID,
      ttlSec: 600,
    }).token;
    expect(await rejectedWith(open(url, '/customer', { token: other }))).toBe('UNAUTHORIZED');
    const old = await start(undefined, () => new Date(Date.now() + 3_600_000));
    expect(await rejectedWith(open(old.url, '/customer', { token: token('CUSTOMER', 60) }))).toBe(
      'UNAUTHORIZED',
    );
  });
  it('refuses a token of another scope with FORBIDDEN (all 3×2 combinations)', async () => {
    const { url } = await start();
    const tokens = {
      '/customer': token('CUSTOMER'),
      '/merchant': token('MEMBER'),
      '/admin': token('ADMIN'),
    };
    for (const [namespace] of Object.entries(tokens)) {
      for (const [other, value] of Object.entries(tokens)) {
        if (other === namespace) continue;
        expect(await rejectedWith(open(url, namespace, { token: value }))).toBe('FORBIDDEN');
      }
    }
  });
});

describe('rooms and delivery', () => {
  it('puts every account in its own room and reports the identity to onConnection', async () => {
    const seen: string[] = [];
    const { url, hub } = await start((scope, _socket, claims) => {
      seen.push(`${scope}:${claims.subjectId}`);
    });
    const customer = open(url, '/customer', { token: token('CUSTOMER') });
    const member = open(url, '/merchant', { token: token('MEMBER') });
    const admin = open(url, '/admin', { token: token('ADMIN') });
    await Promise.all([connected(customer), connected(member), connected(admin)]);
    const got = Promise.all([
      nextEvent(customer, 'ping.test'),
      nextEvent(member, 'ping.test'),
      nextEvent(admin, 'ping.test'),
    ]);
    hub.emit('customer', `customer:${ID}`, 'ping.test', { who: 'customer' });
    hub.emit('merchant', `member:${ID}`, 'ping.test', { who: 'member' });
    hub.emit('admin', 'admin', 'ping.test', { who: 'admin' });
    expect(await got).toEqual([{ who: 'customer' }, { who: 'member' }, { who: 'admin' }]);
    expect(seen.sort()).toEqual([`admin:${ID}`, `customer:${ID}`, `merchant:${ID}`]);
  });
  it('does not deliver to other accounts or other namespaces', async () => {
    const { url, hub } = await start();
    const other = open(url, '/customer', {
      token: token('CUSTOMER', 600, '65a000000000000000000002'),
    });
    await connected(other);
    let received = false;
    other.on('secret', () => {
      received = true;
    });
    hub.emit('customer', `customer:${ID}`, 'secret', {});
    hub.emit('merchant', `customer:${ID}`, 'secret', {});
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(received).toBe(false);
  });
  it('delivers across instances through the Redis adapter', async () => {
    const a = await start();
    const b = await start();
    const client = open(b.url, '/customer', { token: token('CUSTOMER') });
    await connected(client);
    const got = nextEvent(client, 'from.a');
    const received = await repeatUntil(got, () => {
      a.hub.emit('customer', `customer:${ID}`, 'from.a', { n: 1 });
    });
    expect(received).toEqual({ n: 1 });
  });
  it('can disconnect a room (access revoked)', async () => {
    const { url, hub } = await start();
    const client = open(url, '/merchant', { token: token('MEMBER') });
    await connected(client);
    const closed = new Promise((resolve) => client.once('disconnect', resolve));
    await repeatUntil(closed, () => {
      hub.disconnect('merchant', `member:${ID}`);
    });
    expect(client.connected).toBe(false);
  });
});
