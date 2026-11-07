import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { TOKEN_ISSUER, TOKEN_SCOPES, type TokenScope } from '../src/constants/auth';
import { SUBJECT_TYPES, type SubjectType } from '../src/constants/enums';
import { errorHandler } from '../src/middlewares/errorHandler';
import { language } from '../src/middlewares/language';
import { requestId } from '../src/middlewares/requestId';
import { requireAuth } from '../src/middlewares/auth';
import { signAccessToken, verifyAccessToken } from '../src/utils/auth/accessToken';
import { UnauthorizedError } from '../src/utils/errors';
import { createLogger } from '../src/utils/logger';
import { newId } from '../src/utils/database/ids';

const SECRET = 'k'.repeat(48);
const OTHER_SECRET = 'z'.repeat(48);
const NOW = new Date('2026-10-12T10:00:00.000Z');
const SUBJECT = newId();
const SCOPE_OF: Record<SubjectType, TokenScope> = {
  CUSTOMER: 'customer',
  MEMBER: 'merchant',
  ADMIN: 'admin',
};

const sign = (subjectType: SubjectType, ttlSec = 900, secret = SECRET): string =>
  signAccessToken({ secret, subjectType, subjectId: SUBJECT, ttlSec, now: NOW }).token;

describe('signAccessToken / verifyAccessToken', () => {
  it.each(SUBJECT_TYPES)('round-trips a %s token with its scope and expiry', (subjectType) => {
    const { token, expiresAt } = signAccessToken({
      secret: SECRET,
      subjectType,
      subjectId: SUBJECT,
      ttlSec: 900,
      now: NOW,
    });
    expect(expiresAt).toEqual(new Date('2026-10-12T10:15:00.000Z'));
    expect(verifyAccessToken(SECRET, token, NOW)).toEqual({
      subjectType,
      subjectId: SUBJECT,
      scope: SCOPE_OF[subjectType],
      expiresAt,
    });
  });

  it('is valid until the expiry second and invalid from it', () => {
    const token = sign('CUSTOMER', 900);
    expect(() =>
      verifyAccessToken(SECRET, token, new Date('2026-10-12T10:14:59.000Z')),
    ).not.toThrow();
    expect(() => verifyAccessToken(SECRET, token, new Date('2026-10-12T10:15:00.000Z'))).toThrow(
      UnauthorizedError,
    );
  });

  it('rejects a wrong secret, a tampered token and garbage', () => {
    const token = sign('ADMIN');
    expect(() => verifyAccessToken(OTHER_SECRET, token, NOW)).toThrow(UnauthorizedError);
    const [head, body, signature] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(body ?? '', 'base64url').toString()),
        aud: 'admin',
        sub: newId(),
      }),
    ).toString('base64url');
    expect(() =>
      verifyAccessToken(SECRET, `${head ?? ''}.${forged}.${signature ?? ''}`, NOW),
    ).toThrow(UnauthorizedError);
    for (const bad of ['', 'abc', 'a.b.c', `${token}x`]) {
      expect(() => verifyAccessToken(SECRET, bad, NOW)).toThrow(UnauthorizedError);
    }
  });

  it('refuses unsigned tokens and other algorithms', () => {
    const claims = {
      iat: 1_791_000_000,
      exp: 1_791_009_000,
      iss: TOKEN_ISSUER,
      aud: 'admin',
      sub: SUBJECT,
    };
    const unsigned = jwt.sign(claims, '', { algorithm: 'none' });
    const hs512 = jwt.sign(claims, SECRET, { algorithm: 'HS512' });
    expect(() => verifyAccessToken(SECRET, unsigned, NOW)).toThrow(UnauthorizedError);
    expect(() => verifyAccessToken(SECRET, hs512, NOW)).toThrow(UnauthorizedError);
  });

  it('refuses tokens with a wrong issuer, audience, subject or no expiry', () => {
    const base = { iat: 1_791_000_000, exp: 1_791_999_999 };
    const make = (extra: object, options: jwt.SignOptions = {}): string =>
      jwt.sign({ ...base, ...extra }, SECRET, { algorithm: 'HS256', ...options });
    const good = { iss: TOKEN_ISSUER, aud: 'admin', sub: SUBJECT };
    const at = new Date(1_791_000_100 * 1000);
    expect(() => verifyAccessToken(SECRET, make(good), at)).not.toThrow();
    expect(() => verifyAccessToken(SECRET, make({ ...good, iss: 'someone-else' }), at)).toThrow(
      UnauthorizedError,
    );
    expect(() => verifyAccessToken(SECRET, make({ ...good, aud: 'superuser' }), at)).toThrow(
      UnauthorizedError,
    );
    expect(() => verifyAccessToken(SECRET, make({ ...good, aud: undefined }), at)).toThrow(
      UnauthorizedError,
    );
    expect(() => verifyAccessToken(SECRET, make({ ...good, sub: 'not-an-id' }), at)).toThrow(
      UnauthorizedError,
    );
    const noExp = jwt.sign({ iat: 1_791_000_000, ...good }, SECRET, { algorithm: 'HS256' });
    expect(() => verifyAccessToken(SECRET, noExp, at)).toThrow(UnauthorizedError);
  });

  it.each([0, -5, 1.5, Number.NaN])('rejects the lifetime %s when signing', (ttlSec) => {
    expect(() =>
      signAccessToken({
        secret: SECRET,
        subjectType: 'CUSTOMER',
        subjectId: SUBJECT,
        ttlSec,
        now: NOW,
      }),
    ).toThrow(RangeError);
  });

  it('rejects a subject id that is not an ObjectId when signing', () => {
    expect(() =>
      signAccessToken({
        secret: SECRET,
        subjectType: 'CUSTOMER',
        subjectId: 'x',
        ttlSec: 60,
        now: NOW,
      }),
    ).toThrow(RangeError);
  });
});

describe('requireAuth middleware', () => {
  const buildApp = (): Express => {
    const logger = createLogger({ level: 'silent' });
    const app = express();
    app.use(requestId(logger), language);
    for (const scope of TOKEN_SCOPES) {
      app.get(`/${scope}`, requireAuth(scope, SECRET), (req, res) => {
        res.json({ auth: req.auth });
      });
    }
    app.get('/public', (_req, res) => {
      res.json({ ok: true });
    });
    app.use(errorHandler(logger));
    return app;
  };
  const app = buildApp();
  const real = Date.now();

  it.each(
    SUBJECT_TYPES.flatMap((subject) => TOKEN_SCOPES.map((scope) => [subject, scope] as const)),
  )('a %s token on the %s route', async (subject, scope) => {
    const token = signAccessToken({
      secret: SECRET,
      subjectType: subject,
      subjectId: SUBJECT,
      ttlSec: 900,
      now: new Date(real),
    }).token;
    const response = await request(app).get(`/${scope}`).set('Authorization', `Bearer ${token}`);
    if (SCOPE_OF[subject] === scope) {
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        auth: { subjectType: subject, subjectId: SUBJECT, scope },
      });
    } else {
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ success: false, error: { code: 'FORBIDDEN' } });
    }
  });

  const fresh = (subject: SubjectType = 'CUSTOMER'): string =>
    signAccessToken({
      secret: SECRET,
      subjectType: subject,
      subjectId: SUBJECT,
      ttlSec: 900,
      now: new Date(real),
    }).token;

  it.each([
    ['no header', undefined],
    ['a non-Bearer scheme', `Basic ${fresh()}`],
    ['a lower-case scheme', `bearer ${fresh()}`],
    ['an empty token', 'Bearer '],
    ['a malformed token', 'Bearer not.a-jwt'],
    ['two tokens', `Bearer ${fresh()} ${fresh()}`],
  ])('answers 401 UNAUTHORIZED for %s', async (_label, header) => {
    const call = request(app).get(`/${SCOPE_OF.CUSTOMER}`);
    const response = await (header === undefined ? call : call.set('Authorization', header));
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, error: { code: 'UNAUTHORIZED' } });
  });

  it('answers 401 for an expired token and for one signed with another secret', async () => {
    const expired = signAccessToken({
      secret: SECRET,
      subjectType: 'CUSTOMER',
      subjectId: SUBJECT,
      ttlSec: 60,
      now: new Date(real - 3_600_000),
    }).token;
    const foreign = signAccessToken({
      secret: OTHER_SECRET,
      subjectType: 'CUSTOMER',
      subjectId: SUBJECT,
      ttlSec: 900,
      now: new Date(real),
    }).token;
    for (const token of [expired, foreign]) {
      const response = await request(app)
        .get(`/${SCOPE_OF.CUSTOMER}`)
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(401);
    }
  });

  it('leaves routes without the middleware public', async () => {
    expect((await request(app).get('/public')).status).toBe(200);
  });
});
