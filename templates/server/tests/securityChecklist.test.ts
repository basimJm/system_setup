import fs from 'node:fs';
import path from 'node:path';
import { Types } from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app';
import { requireAuth } from '../src/middlewares/auth';
import { signAccessToken } from '../src/utils/auth/accessToken';
import { createLogger } from '../src/utils/logger';

const root = path.resolve(__dirname, '..');
const logger = createLogger({ level: 'silent' });
const SECRET = 'a'.repeat(48);
const SECOND_SECRET = 'b'.repeat(48);
const CONTROLS = 18;

describe('docs/SECURITY_CHECKLIST.md', () => {
  const text = fs.readFileSync(path.join(root, 'docs/SECURITY_CHECKLIST.md'), 'utf8');
  const rows = text.split('\n').filter((line) => /^\| \d+ /.test(line));

  it('names only files that exist', () => {
    const named = [...text.matchAll(/`((?:src|tests|docs)\/[A-Za-z0-9_./-]+)`/g)].map(
      (m) => m[1] ?? '',
    );
    expect(named.length).toBeGreaterThan(20);
    expect([...new Set(named)].filter((file) => !fs.existsSync(path.join(root, file)))).toEqual([]);
  });

  it(`has a proof column entry for each of the ${String(CONTROLS)} controls, every status DONE, PLATFORM or PARTIAL`, () => {
    expect(rows).toHaveLength(CONTROLS);
    for (const row of rows) {
      expect(row.split('|').length).toBeGreaterThanOrEqual(7);
      expect(row).toMatch(/\| (DONE|PLATFORM|PARTIAL)\s+\|/);
    }
  });
});

describe('every admin route is protected', () => {
  interface OpenApi {
    paths: Record<string, Record<string, unknown>>;
  }
  const doc = JSON.parse(
    fs.readFileSync(path.join(root, 'docs/api/openapi.admin.json'), 'utf8'),
  ) as OpenApi;
  // Only the sign-in family is reachable without a token.
  const protectedRoutes = Object.entries(doc.paths)
    .filter(([p]) => !p.startsWith('/admin/v1/auth/'))
    .flatMap(([p, ops]) =>
      Object.keys(ops).map((method) => ({
        method: method as 'get' | 'post' | 'put' | 'patch' | 'delete',
        url: p.replace(/\{[^}]+\}/g, new Types.ObjectId().toHexString()),
      })),
    );
  // A guard-only app: if any router forgot its guard the request would not be answered 401.
  const app = createApp({
    logger,
    services: { adminGuard: requireAuth('admin', SECRET) },
    security: { rateLimit: { windowMs: 60_000, max: 1_000_000 } },
  });
  const tokenFor = (type: 'CUSTOMER' | 'MEMBER' | 'ADMIN', secret = SECRET, ttl = 600): string =>
    `Bearer ${signAccessToken({ secret, subjectType: type, subjectId: new Types.ObjectId().toHexString(), ttlSec: ttl }).token}`;

  it('covers every documented admin route', () => {
    expect(protectedRoutes.length).toBeGreaterThan(5);
  });

  it.each(['missing', 'garbage', 'wrong secret', 'customer scope', 'merchant scope'])(
    'refuses a request with %s credentials on every route',
    async (kind) => {
      const authorization =
        kind === 'missing'
          ? undefined
          : kind === 'garbage'
            ? 'Bearer not-a-token'
            : kind === 'wrong secret'
              ? tokenFor('ADMIN', SECOND_SECRET)
              : kind === 'customer scope'
                ? tokenFor('CUSTOMER')
                : tokenFor('MEMBER');
      const expected = kind === 'customer scope' || kind === 'merchant scope' ? 403 : 401;
      const wrong: string[] = [];
      for (const route of protectedRoutes) {
        let req = request(app)[route.method](route.url);
        if (authorization !== undefined) req = req.set('Authorization', authorization);
        const res = await req.send(route.method === 'get' ? undefined : {});
        if (res.status !== expected)
          wrong.push(`${route.method.toUpperCase()} ${route.url} -> ${String(res.status)}`);
      }
      expect(wrong).toEqual([]);
    },
  );

  it('an expired admin token is refused; a valid one passes the guard (then 503: no service wired)', async () => {
    const expired = `Bearer ${signAccessToken({ secret: SECRET, subjectType: 'ADMIN', subjectId: new Types.ObjectId().toHexString(), ttlSec: 1, now: new Date(Date.now() - 3_600_000) }).token}`;
    expect(
      (await request(app).get('/admin/v1/settings').set('Authorization', expired)).status,
    ).toBe(401);
    expect(
      (await request(app).get('/admin/v1/settings').set('Authorization', tokenFor('ADMIN'))).status,
    ).toBe(503);
  });
});
