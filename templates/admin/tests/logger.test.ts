import { describe, expect, it, vi } from 'vitest';
import { REDACTED } from '@/constants/logging';
import { createLogger, type LogSink } from '@/infrastructure/logger/logger';
import { redact } from '@/infrastructure/logger/redact';

describe('redact', () => {
  it('hides sensitive keys at any depth without mutating the input', () => {
    const input = {
      user: { email: 'a@b.c', password: 'p', nested: [{ accessToken: 't', otp: '123456' }] },
    };
    const out = redact(input) as typeof input;
    expect(out.user.password).toBe(REDACTED);
    expect(out.user.nested[0]).toEqual({ accessToken: REDACTED, otp: REDACTED });
    expect(out.user.email).toBe('a@b.c');
    expect(input.user.password).toBe('p');
  });

  it('survives cycles, deep objects and errors', () => {
    const loop: Record<string, unknown> = {};
    loop['self'] = loop;
    expect(redact(loop)).toEqual({ self: '[Circular]' });
    expect(JSON.stringify(redact({ a: { b: { c: { d: { e: { f: 1 } } } } } }))).toContain(
      '[Truncated]',
    );
    expect(redact(new Error('boom'))).toEqual({ name: 'Error', message: 'boom' });
  });
});

describe('createLogger', () => {
  it('respects the level and redacts context', () => {
    const sink = vi.fn<LogSink>();
    const log = createLogger('warn', sink);
    log.debug('d');
    log.info('i');
    log.warn('w', { token: 'secret' });
    log.error('e');
    expect(sink.mock.calls.map((c) => c[0])).toEqual(['warn', 'error']);
    expect(sink.mock.calls[0]?.[2]).toEqual({ token: REDACTED });
  });

  it('silent logs nothing', () => {
    const sink = vi.fn<LogSink>();
    const log = createLogger('silent', sink);
    log.error('e');
    expect(sink).not.toHaveBeenCalled();
  });
});
