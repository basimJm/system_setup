import { HttpSink, mapStatus } from '../src/adapters/http';
import { FakeSink, MemorySink } from '../src/adapters/memory';
import { ERROR_CODES } from '../src/constants/analytics';
import type { Envelope } from '../src/types';

const envelope = (name: string): Envelope => ({
  id: name,
  type: 'track',
  name,
  userId: 'u1',
  properties: {},
  occurredAt: new Date(0),
});

describe('memory and fake sinks', () => {
  it('record batches, filter by name, clear and inject failures', async () => {
    const memory = new MemorySink();
    await memory.deliver([envelope('a'), envelope('b')]);
    await memory.deliver([envelope('a')]);
    expect(memory.named('a')).toHaveLength(2);
    expect(memory.batches).toEqual([2, 1]);
    memory.clear();
    expect(memory.events).toHaveLength(0);
    const fake = new FakeSink();
    expect(fake.name).toBe('fake');
    fake.failWith = new Error('down');
    await expect(fake.deliver([envelope('a')])).rejects.toThrow('down');
    fake.failWith = undefined;
    await fake.deliver([envelope('a')]);
    expect(fake.refused).toBe(1);
    expect(fake.events).toHaveLength(1);
  });
});

describe('HttpSink', () => {
  it('maps every collector status', () => {
    expect(mapStatus(200)).toBe('ok');
    expect(mapStatus(202)).toBe('ok');
    const codes = [401, 403, 429, 500, 400].map((status) => {
      const mapped = mapStatus(status);
      return mapped === 'ok' ? 'ok' : [mapped.code, mapped.retryable];
    });
    expect(codes).toEqual([
      [ERROR_CODES.AUTH_FAILED, false],
      [ERROR_CODES.AUTH_FAILED, false],
      [ERROR_CODES.RATE_LIMITED, true],
      [ERROR_CODES.UNAVAILABLE, true],
      [ERROR_CODES.VENDOR_ERROR, false],
    ]);
  });

  it('posts JSON batches with the bearer key and wraps failures', async () => {
    const calls: {
      url: string;
      init: { method: string; headers: Record<string, string>; body: string };
    }[] = [];
    let status = 202;
    const sink = new HttpSink({
      endpoint: 'http://localhost:9999/ingest',
      apiKey: 'k',
      timeoutMs: 20,
      fetch: (url, init) => {
        calls.push({ url, init });
        return Promise.resolve({ status });
      },
    });
    await sink.deliver([envelope('a')]);
    expect(calls[0]?.url).toBe('http://localhost:9999/ingest');
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer k',
    });
    expect(JSON.parse(calls[0]?.init.body ?? '{}')).toMatchObject({
      events: [{ id: 'a', name: 'a' }],
    });
    status = 503;
    await expect(sink.deliver([envelope('a')])).rejects.toMatchObject({
      code: ERROR_CODES.UNAVAILABLE,
      retryable: true,
    });
    const anonymous = new HttpSink({
      endpoint: 'http://localhost:9999/ingest',
      apiKey: undefined,
      timeoutMs: 20,
      fetch: () => Promise.reject(new Error('refused')),
    });
    await expect(anonymous.deliver([envelope('a')])).rejects.toMatchObject({
      code: ERROR_CODES.NETWORK_ERROR,
    });
    const slow = new HttpSink({
      endpoint: 'http://localhost:9999/ingest',
      apiKey: undefined,
      timeoutMs: 1,
      fetch: () => new Promise(() => undefined),
    });
    await expect(slow.deliver([envelope('a')])).rejects.toMatchObject({
      code: ERROR_CODES.TIMEOUT,
    });
  });
});
