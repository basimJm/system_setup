import { ERROR_CODES } from '../src';
import { HttpSmsChannel, mapSmsStatus, type FetchLike } from '../src/adapters/http-sms';

const message = {
  to: '+10000000000',
  code: '123456',
  language: 'en',
  purpose: 'LOGIN',
  ttlSec: 300,
};
const render = (m: typeof message): string => `Code ${m.code}`;

interface Seen {
  url: string;
  headers: Readonly<Record<string, string>>;
  body: string;
  signal: AbortSignal;
}

const channel = (
  answer: () => Promise<{ status: number; text(): Promise<string> }>,
  seen: Seen[] = [],
  extra: { sender?: string; timeoutMs?: number } = {},
): HttpSmsChannel =>
  new HttpSmsChannel({
    url: 'https://sms.example.test/send',
    apiKey: 'key-1',
    render,
    ...extra,
    fetch: ((url, init) => {
      seen.push({ url, headers: init.headers, body: init.body, signal: init.signal });
      return answer();
    }) satisfies FetchLike,
  });

const reply = (status: number, body: string) => () =>
  Promise.resolve({ status, text: () => Promise.resolve(body) });

describe('HttpSmsChannel', () => {
  it('posts the rendered text with a bearer key and returns the gateway id', async () => {
    const seen: Seen[] = [];
    const sms = channel(reply(200, '{"id":"m-1"}'), seen, { sender: 'Brand', timeoutMs: 500 });
    await expect(sms.send(message)).resolves.toEqual({ id: 'm-1' });
    expect(seen[0]?.url).toBe('https://sms.example.test/send');
    expect(seen[0]?.headers['authorization']).toBe('Bearer key-1');
    expect(JSON.parse(seen[0]?.body ?? '')).toEqual({
      to: '+10000000000',
      text: 'Code 123456',
      from: 'Brand',
    });
    expect(sms.name).toBe('http-sms');
  });

  it('accepts a numeric messageId, omits the sender when there is none and uses the default timeout', async () => {
    const seen: Seen[] = [];
    await expect(channel(reply(202, '{"messageId":42}'), seen).send(message)).resolves.toEqual({
      id: '42',
    });
    expect(JSON.parse(seen[0]?.body ?? '')).toEqual({ to: '+10000000000', text: 'Code 123456' });
  });

  it('rejects an answer without an id, or that is not JSON', async () => {
    for (const body of ['{}', 'not json', 'null', '{"id":true}'])
      await expect(channel(reply(200, body)).send(message)).rejects.toMatchObject({
        code: ERROR_CODES.MALFORMED_RESPONSE,
      });
  });

  it('maps every status', async () => {
    expect(mapSmsStatus(204)).toBeUndefined();
    expect(mapSmsStatus(401)).toMatchObject({ code: ERROR_CODES.AUTH_FAILED, retryable: false });
    expect(mapSmsStatus(403)).toMatchObject({ code: ERROR_CODES.AUTH_FAILED });
    expect(mapSmsStatus(429)).toMatchObject({ code: ERROR_CODES.RATE_LIMITED, retryable: true });
    expect(mapSmsStatus(503)).toMatchObject({ code: ERROR_CODES.UNAVAILABLE, retryable: true });
    expect(mapSmsStatus(400)).toMatchObject({ code: ERROR_CODES.VENDOR_ERROR, retryable: false });
    await expect(channel(reply(503, '')).send(message)).rejects.toMatchObject({
      code: ERROR_CODES.UNAVAILABLE,
    });
  });

  it('maps transport failures: timeout and network, both retryable', async () => {
    const timeout = Object.assign(new Error('t'), { name: 'TimeoutError' });
    await expect(channel(() => Promise.reject(timeout)).send(message)).rejects.toMatchObject({
      code: ERROR_CODES.TIMEOUT,
      retryable: true,
    });
    await expect(
      channel(() => Promise.reject(new Error('dns'))).send(message),
    ).rejects.toMatchObject({ code: ERROR_CODES.NETWORK_ERROR, retryable: true });
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- a vendor may throw a non-Error
    await expect(channel(() => Promise.reject('plain')).send(message)).rejects.toMatchObject({
      code: ERROR_CODES.NETWORK_ERROR,
    });
  });

  it('uses the global fetch when none is injected', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => Promise.resolve(new Response('{"id":"g-1"}', { status: 200 }));
    try {
      const sms = new HttpSmsChannel({ url: 'https://sms.example.test/send', apiKey: 'k', render });
      await expect(sms.send(message)).resolves.toEqual({ id: 'g-1' });
    } finally {
      globalThis.fetch = original;
    }
  });
});
