import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REALTIME_RECONNECT } from '@/constants/realtime';
import { createLogger } from '@/infrastructure/logger/logger';

type Listener = (arg?: Error) => void;
const sockets: FakeSocket[] = [];
class FakeSocket {
  listeners = new Map<string, Listener[]>();
  disconnected = false;
  /** Socket.IO keeps retrying transport errors itself (active) but not a middleware refusal. */
  active = true;
  connects = 0;
  constructor(
    public url: string,
    public options: { auth: (done: (data: unknown) => void) => void },
  ) {
    sockets.push(this);
  }
  on(event: string, fn: Listener) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), fn]);
    return this;
  }
  off(event: string, fn: Listener) {
    this.listeners.set(
      event,
      (this.listeners.get(event) ?? []).filter((l) => l !== fn),
    );
  }
  disconnect() {
    this.disconnected = true;
  }
  connect() {
    this.connects += 1;
  }
  fire(event: string, arg?: Error) {
    (this.listeners.get(event) ?? []).forEach((l) => l(arg));
  }
}
vi.mock('socket.io-client', () => ({
  io: (url: string, options: FakeSocket['options']) => new FakeSocket(url, options),
}));

const { SocketIoRealtimeClient, retryDelayMs } =
  await import('@/data/realtime/SocketIoRealtimeClient');
const make = () => new SocketIoRealtimeClient('https://api.example.test', createLogger('silent'));

beforeEach(() => (sockets.length = 0));
afterEach(() => vi.useRealTimers());

/** A middleware refusal as the server sends it: Socket.IO marks the socket inactive and does not retry. */
const refuse = (socket: FakeSocket | undefined, code: string) => {
  if (!socket) throw new Error('no socket');
  socket.active = false;
  socket.fire('connect_error', new Error(code));
};

describe('SocketIoRealtimeClient', () => {
  it('joins the /admin namespace and sends the current token on every (re)connect', () => {
    let token: string | null = 't1';
    make().connect(() => token);
    const socket = sockets[0];
    expect(socket?.url).toBe('https://api.example.test/admin');
    const sent: unknown[] = [];
    socket?.options.auth((d) => sent.push(d));
    token = 't2';
    socket?.options.auth((d) => sent.push(d));
    expect(sent).toEqual([{ token: 't1' }, { token: 't2' }]);
  });

  it('follows connect, drop and retry as live, reconnecting, live', () => {
    const client = make();
    const seen: string[] = [];
    client.onStatus((s) => seen.push(s));
    client.connect(() => 't');
    sockets[0]?.fire('connect');
    sockets[0]?.fire('disconnect');
    sockets[0]?.fire('connect_error', new Error('xhr poll error'));
    sockets[0]?.fire('connect');
    expect(seen).toEqual(['connecting', 'live', 'reconnecting', 'live']);
  });

  it('FORBIDDEN (token of another scope) stops for good and reports denied', () => {
    vi.useFakeTimers();
    const client = make();
    client.connect(() => 't');
    refuse(sockets[0], 'FORBIDDEN');
    vi.advanceTimersByTime(REALTIME_RECONNECT.maxMs * 4);
    expect(client.status()).toBe('denied');
    expect(sockets[0]?.disconnected).toBe(true);
    expect(sockets[0]?.connects).toBe(0);
  });

  it('UNAUTHORIZED waits for a refreshed token, then reconnects with it', () => {
    vi.useFakeTimers();
    let token: string | null = 'expired';
    const client = make();
    client.connect(() => token);
    const socket = sockets[0];
    socket?.options.auth(() => undefined);
    refuse(socket, 'UNAUTHORIZED');
    expect(client.status()).toBe('denied');
    vi.advanceTimersByTime(REALTIME_RECONNECT.maxMs * 2);
    expect(socket?.connects).toBe(0);
    token = null;
    vi.advanceTimersByTime(REALTIME_RECONNECT.maxMs);
    expect(socket?.connects).toBe(0);
    token = 'fresh';
    vi.advanceTimersByTime(REALTIME_RECONNECT.maxMs);
    expect(socket?.connects).toBe(1);
    expect(client.status()).toBe('connecting');
    expect(socket?.disconnected).toBe(false);
  });

  it('UNAVAILABLE (server rooms lookup failed) is retried after a backoff', () => {
    vi.useFakeTimers();
    const client = make();
    client.connect(() => 't');
    refuse(sockets[0], 'UNAVAILABLE');
    expect(client.status()).toBe('reconnecting');
    vi.advanceTimersByTime(retryDelayMs(0) - 1);
    expect(sockets[0]?.connects).toBe(0);
    vi.advanceTimersByTime(1);
    expect(sockets[0]?.connects).toBe(1);
  });

  it('transport errors are left to Socket.IO; disconnect cancels a pending retry', () => {
    vi.useFakeTimers();
    const client = make();
    client.connect(() => 't');
    sockets[0]?.fire('connect_error', new Error('websocket error'));
    vi.advanceTimersByTime(REALTIME_RECONNECT.maxMs);
    expect(sockets[0]?.connects).toBe(0);
    refuse(sockets[0], 'UNAVAILABLE');
    client.disconnect();
    vi.advanceTimersByTime(REALTIME_RECONNECT.maxMs);
    expect(sockets[0]?.connects).toBe(0);
    expect(client.status()).toBe('idle');
  });

  it('backoff doubles from the base and is capped', () => {
    expect(retryDelayMs(0)).toBe(REALTIME_RECONNECT.baseMs);
    expect(retryDelayMs(1)).toBe(REALTIME_RECONNECT.baseMs * 2);
    expect(retryDelayMs(50)).toBe(REALTIME_RECONNECT.maxMs);
  });

  it('keeps handlers registered before and after connecting, and unsubscribes', () => {
    const client = make();
    const early = vi.fn();
    client.on('alert.created', early);
    client.connect(() => 't');
    const late = vi.fn();
    const off = client.on('alert.created', late);
    sockets[0]?.fire('alert.created');
    off();
    sockets[0]?.fire('alert.created');
    expect(early).toHaveBeenCalledTimes(2);
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('disconnect closes the socket and returns to idle; connect twice opens one socket', () => {
    const client = make();
    client.connect(() => 't');
    client.connect(() => 't');
    expect(sockets).toHaveLength(1);
    client.disconnect();
    expect(sockets[0]?.disconnected).toBe(true);
    expect(client.status()).toBe('idle');
  });
});
