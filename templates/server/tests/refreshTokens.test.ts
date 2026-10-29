import { createHash } from 'node:crypto';
import { Types } from 'mongoose';
import { MS_PER_DAY } from '../src/constants/time';
import { createRefreshTokenService } from '../src/domain/auth/refreshTokens.service';
import { RefreshTokensRepository } from '../src/repositories/identity.repository';
import { UnauthorizedError } from '../src/utils/errors';
import type { Logger } from '../src/utils/logger';
import { createFakeModel } from './helpers/fakeModel';

const START = new Date('2026-10-12T10:00:00.000Z');
const TTL = 90;
const sha = (value: string): string => createHash('sha256').update(value).digest('hex');

const setup = (): {
  service: ReturnType<typeof createRefreshTokenService>;
  docs: Record<string, unknown>[];
  warnings: unknown[][];
  clock: { now: Date };
} => {
  const fake = createFakeModel();
  const warnings: unknown[][] = [];
  const logger = { warn: (...args: unknown[]) => warnings.push(args) } as unknown as Logger;
  const clock = { now: START };
  let counter = 0;
  const service = createRefreshTokenService({
    repository: new RefreshTokensRepository(fake.model as never),
    logger,
    now: () => clock.now,
    randomBytes: (size) => Buffer.alloc(size, ++counter),
  });
  return { service, docs: fake.docs, warnings, clock };
};

const subjectId = new Types.ObjectId().toHexString();
const login = {
  subjectType: 'CUSTOMER',
  subjectId,
  installationId: 'install-abc-123',
  ttlDays: TTL,
} as const;

describe('refresh tokens: issue', () => {
  it('returns a 43-char token, stores only its SHA-256 and sets the expiry', async () => {
    const { service, docs } = setup();
    const issued = await service.issue(login);
    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(issued.expiresAt.getTime()).toBe(START.getTime() + TTL * MS_PER_DAY);
    expect(docs).toHaveLength(1);
    expect(docs[0]?.['tokenHash']).toBe(sha(issued.token));
    expect(JSON.stringify(docs)).not.toContain(issued.token);
    expect(docs[0]?.['familyId']).toMatch(/^[a-f0-9]{32}$/);
  });

  it('starts a new family per login', async () => {
    const { service, docs } = setup();
    await service.issue(login);
    await service.issue(login);
    expect(docs[0]?.['familyId']).not.toBe(docs[1]?.['familyId']);
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects ttlDays %s', async (ttlDays) => {
    await expect(setup().service.issue({ ...login, ttlDays })).rejects.toBeInstanceOf(RangeError);
  });
});

describe('refresh tokens: lifetime in seconds (admin idle timeout)', () => {
  const sessionOf = { subjectType: 'ADMIN', subjectId } as const;

  it('issues a token that lives for the given seconds and rotates with a fresh window', async () => {
    const { service, clock } = setup();
    const first = await service.issue({ ...sessionOf, ttlSec: 1800 });
    expect(first.expiresAt.getTime()).toBe(START.getTime() + 1_800_000);
    clock.now = new Date(START.getTime() + 1_500_000);
    const next = await service.rotate({ token: first.token, ttlSec: 1800 });
    expect(next.expiresAt.getTime()).toBe(clock.now.getTime() + 1_800_000);
  });

  it('expires exactly at the limit', async () => {
    const { service, clock } = setup();
    const { token } = await service.issue({ ...sessionOf, ttlSec: 60 });
    clock.now = new Date(START.getTime() + 60_000);
    await expect(service.rotate({ token, ttlSec: 60 })).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it.each([0, -5, 1.5, Number.NaN])('rejects ttlSec %s as a caller bug', async (ttlSec) => {
    const { service } = setup();
    await expect(service.issue({ ...sessionOf, ttlSec })).rejects.toBeInstanceOf(RangeError);
    const { token } = await service.issue({ ...sessionOf, ttlDays: 1 });
    await expect(service.rotate({ token, ttlSec })).rejects.toBeInstanceOf(RangeError);
  });
});

describe('refresh tokens: rotate', () => {
  it('replaces the token, keeping family, subject and installation', async () => {
    const { service, docs } = setup();
    const first = await service.issue(login);
    const second = await service.rotate({ token: first.token, ttlDays: TTL });
    expect(second.token).not.toBe(first.token);
    expect(second).toMatchObject({
      subjectType: 'CUSTOMER',
      subjectId,
      installationId: 'install-abc-123',
    });
    expect(docs).toHaveLength(2);
    expect(docs[1]?.['familyId']).toBe(docs[0]?.['familyId']);
    expect(docs[0]).toMatchObject({ revokedReason: 'ROTATED' });
    expect(docs[0]?.['revokedAt']).toEqual(START);
    expect(String(docs[0]?.['replacedBy'])).toBe(String(docs[1]?.['_id']));
    expect(docs[1]?.['revokedAt']).toBeUndefined();
  });

  it('can rotate a chain repeatedly', async () => {
    const { service } = setup();
    let current = await service.issue(login);
    for (let i = 0; i < 3; i += 1)
      current = await service.rotate({ token: current.token, ttlDays: TTL });
    await expect(service.rotate({ token: current.token, ttlDays: TTL })).resolves.toBeDefined();
  });

  it.each(['', 'short', 'x'.repeat(43) + '!', 'A'.repeat(44), 'A'.repeat(43)])(
    'rejects malformed or unknown token %j',
    async (token) => {
      await expect(setup().service.rotate({ token, ttlDays: TTL })).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
    },
  );

  it('rejects an expired token, valid until the instant before expiry', async () => {
    const { service, clock } = setup();
    const { token, expiresAt } = await service.issue(login);
    clock.now = new Date(expiresAt.getTime() - 1);
    const rotated = await service.rotate({ token, ttlDays: TTL });
    clock.now = new Date(rotated.expiresAt.getTime());
    await expect(service.rotate({ token: rotated.token, ttlDays: TTL })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('treats reuse of a rotated token as theft: the whole family is revoked and logged without the token', async () => {
    const { service, docs, warnings } = setup();
    const first = await service.issue(login);
    const second = await service.rotate({ token: first.token, ttlDays: TTL });
    await expect(service.rotate({ token: first.token, ttlDays: TTL })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(docs[1]).toMatchObject({ revokedReason: 'REUSE_DETECTED' });
    await expect(service.rotate({ token: second.token, ttlDays: TTL })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(warnings).toHaveLength(2);
    const logged = JSON.stringify(warnings);
    expect(logged).not.toContain(first.token);
    expect(logged).not.toContain(second.token);
  });

  it('leaves other families untouched on reuse', async () => {
    const { service, docs } = setup();
    const mine = await service.issue(login);
    const other = await service.issue(login);
    await service.rotate({ token: mine.token, ttlDays: TTL });
    await expect(service.rotate({ token: mine.token, ttlDays: TTL })).rejects.toThrow();
    expect(docs.find((d) => d['tokenHash'] === sha(other.token))?.['revokedAt']).toBeUndefined();
  });

  it('lets exactly one of two concurrent rotations win', async () => {
    const { service } = setup();
    const { token } = await service.issue(login);
    const results = await Promise.allSettled([
      service.rotate({ token, ttlDays: TTL }),
      service.rotate({ token, ttlDays: TTL }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('rejects an invalid ttl as a caller bug', async () => {
    const { service } = setup();
    const { token } = await service.issue(login);
    await expect(service.rotate({ token, ttlDays: 0 })).rejects.toBeInstanceOf(RangeError);
  });
});

describe('refresh tokens: logout', () => {
  it('revokes the token so it cannot be rotated, and is idempotent', async () => {
    const { service, docs } = setup();
    const { token } = await service.issue(login);
    await service.revoke(token);
    await service.revoke(token);
    expect(docs[0]).toMatchObject({ revokedReason: 'LOGOUT' });
    await expect(service.rotate({ token, ttlDays: TTL })).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('ignores unknown and malformed tokens silently', async () => {
    const { service } = setup();
    await expect(service.revoke('A'.repeat(43))).resolves.toBeNull();
    await expect(service.revoke('nope')).resolves.toBeNull();
  });

  it('logout-all revokes only active tokens of that account', async () => {
    const { service, docs } = setup();
    const otherId = new Types.ObjectId().toHexString();
    const a = await service.issue(login);
    await service.issue(login);
    await service.issue({ ...login, subjectId: otherId });
    await service.issue({ ...login, subjectType: 'MEMBER' });
    await service.revoke(a.token);
    const count = await service.revokeAll('CUSTOMER', subjectId);
    expect(count).toBe(1);
    expect(docs.map((d) => d['revokedReason'])).toEqual([
      'LOGOUT',
      'LOGOUT_ALL',
      undefined,
      undefined,
    ]);
  });

  it('accepts a custom reason and returns 0 for a malformed account id', async () => {
    const { service, docs } = setup();
    await service.issue(login);
    await expect(service.revokeAll('CUSTOMER', subjectId, 'BLOCKED')).resolves.toBe(1);
    expect(docs[0]).toMatchObject({ revokedReason: 'BLOCKED' });
    await expect(service.revokeAll('CUSTOMER', 'bad')).resolves.toBe(0);
  });
});
