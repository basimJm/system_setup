import { Writable } from 'node:stream';
import { REDACTION_PLACEHOLDER, SERVICE_NAME } from '../src/constants/logging';
import { createLogger } from '../src/utils/logger';
import { maskPhone, redactSensitive } from '../src/utils/logger/redact';

const memoryStream = (): { stream: Writable; lines: () => Record<string, unknown>[] } => {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback): void {
      chunks.push(chunk.toString());
      callback();
    },
  });
  return {
    stream,
    lines: () =>
      chunks
        .join('')
        .split('\n')
        .filter((line) => line !== '')
        .map((line) => JSON.parse(line) as Record<string, unknown>),
  };
};

describe('maskPhone', () => {
  it('keeps only the last three digits and the plus sign', () => {
    expect(maskPhone('+991788123456')).toBe('+*********456');
  });

  it('masks short values entirely down to the visible tail', () => {
    expect(maskPhone('12')).toBe('12');
    expect(maskPhone('')).toBe('');
  });
});

describe('redactSensitive', () => {
  it('removes secrets regardless of key casing or separators', () => {
    const result = redactSensitive({
      Authorization: 'Bearer abc',
      refresh_token: 'r',
      passwordHash: 'h',
      otp: '123456',
      apiKey: 'sk-live-not-a-real-key',
      safe: 'visible',
    });
    expect(result).toEqual({
      Authorization: REDACTION_PLACEHOLDER,
      refresh_token: REDACTION_PLACEHOLDER,
      passwordHash: REDACTION_PLACEHOLDER,
      otp: REDACTION_PLACEHOLDER,
      apiKey: REDACTION_PLACEHOLDER,
      safe: 'visible',
    });
  });

  it('redacts nested objects and arrays', () => {
    const result = redactSensitive({ body: { user: { password: 'p' } }, list: [{ token: 't' }] });
    expect(result).toEqual({
      body: { user: { password: REDACTION_PLACEHOLDER } },
      list: [{ token: REDACTION_PLACEHOLDER }],
    });
  });

  it('masks phone numbers, including the object form', () => {
    const result = redactSensitive({
      phone: { dialCode: '+991', number: '788123456', e164: '+991788123456' },
      mobile: '0788123456',
    });
    expect(result).toEqual({
      phone: { dialCode: '+991', number: '******456', e164: '+*********456' },
      mobile: '*******456',
    });
  });

  it('does not mutate its input', () => {
    const input = { password: 'p', nested: { token: 't' } };
    redactSensitive(input);
    expect(input).toEqual({ password: 'p', nested: { token: 't' } });
  });

  it('survives circular references and very deep objects', () => {
    const circular: Record<string, unknown> = { name: 'loop' };
    circular['self'] = circular;
    expect(JSON.stringify(redactSensitive(circular))).toContain('[Circular]');

    let deep: Record<string, unknown> = { password: 'deep-secret' };
    for (let i = 0; i < 20; i += 1) deep = { child: deep };
    expect(JSON.stringify(redactSensitive(deep))).not.toContain('deep-secret');
  });
});

describe('createLogger', () => {
  it('writes JSON with service name and redacts sensitive fields', () => {
    const { stream, lines } = memoryStream();
    const logger = createLogger({ level: 'info', destination: stream });
    logger.info({ token: 'secret-token', phone: '+991788123456', orderId: 'o1' }, 'login');
    const [line] = lines();
    expect(line).toMatchObject({ service: SERVICE_NAME, msg: 'login', orderId: 'o1' });
    expect(line?.['token']).toBe(REDACTION_PLACEHOLDER);
    expect(line?.['phone']).toBe('+*********456');
  });

  it('respects the configured level', () => {
    const { stream, lines } = memoryStream();
    const logger = createLogger({ level: 'warn', destination: stream });
    logger.info('hidden');
    logger.warn('shown');
    expect(lines().map((l) => l['msg'])).toEqual(['shown']);
  });

  it('serializes errors with message and stack', () => {
    const { stream, lines } = memoryStream();
    const logger = createLogger({ level: 'error', destination: stream });
    logger.error({ err: new Error('boom') }, 'failed');
    const err = lines()[0]?.['err'] as { message: string; stack: string };
    expect(err.message).toBe('boom');
    expect(err.stack).toContain('Error: boom');
  });
});
