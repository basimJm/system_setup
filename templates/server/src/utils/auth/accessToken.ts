import jwt from 'jsonwebtoken';
import {
  SCOPE_BY_SUBJECT,
  TOKEN_ALGORITHM,
  TOKEN_ISSUER,
  TOKEN_SCOPES,
  type TokenScope,
} from '../../constants/auth';
import type { SubjectType } from '../../constants/enums';
import { MS_PER_SECOND } from '../../constants/time';
import { UnauthorizedError } from '../errors';
import { isObjectIdString } from '../database/ids';

export interface AccessTokenClaims {
  readonly subjectType: SubjectType;
  readonly subjectId: string;
  readonly scope: TokenScope;
  readonly expiresAt: Date;
}

export interface SignAccessTokenInput {
  readonly secret: string;
  readonly subjectType: SubjectType;
  readonly subjectId: string;
  /** From `settings.auth.accessTokenTtlSec`. */
  readonly ttlSec: number;
  readonly now?: Date;
}

const SUBJECT_BY_SCOPE: Readonly<Record<TokenScope, SubjectType>> = {
  customer: 'CUSTOMER',
  merchant: 'MEMBER',
  admin: 'ADMIN',
};

/** Signs a short-lived access token whose audience is the scope of the subject's namespace. */
export const signAccessToken = ({
  secret,
  subjectType,
  subjectId,
  ttlSec,
  now = new Date(),
}: SignAccessTokenInput): { token: string; expiresAt: Date } => {
  if (!isObjectIdString(subjectId)) throw new RangeError('subjectId must be an ObjectId string');
  if (!Number.isSafeInteger(ttlSec) || ttlSec <= 0)
    throw new RangeError('ttlSec must be a positive whole number');
  const issuedAt = Math.floor(now.getTime() / MS_PER_SECOND);
  const token = jwt.sign({ iat: issuedAt }, secret, {
    algorithm: TOKEN_ALGORITHM,
    issuer: TOKEN_ISSUER,
    audience: SCOPE_BY_SUBJECT[subjectType],
    subject: subjectId,
    expiresIn: ttlSec,
  });
  return { token, expiresAt: new Date((issuedAt + ttlSec) * MS_PER_SECOND) };
};

/**
 * Checks signature (HS256 only), issuer, expiry and shape. Anything wrong is a 401; whether the
 * scope fits the route is the middleware's decision (403).
 */
export const verifyAccessToken = (
  secret: string,
  token: string,
  now: Date = new Date(),
): AccessTokenClaims => {
  let payload: jwt.JwtPayload;
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: [TOKEN_ALGORITHM],
      issuer: TOKEN_ISSUER,
      clockTimestamp: Math.floor(now.getTime() / MS_PER_SECOND),
    });
    if (typeof decoded === 'string') throw new UnauthorizedError();
    payload = decoded;
  } catch (error) {
    throw new UnauthorizedError({ cause: error });
  }
  const scope = TOKEN_SCOPES.find((candidate) => candidate === payload.aud);
  const { sub, exp } = payload;
  if (scope === undefined || sub === undefined || !isObjectIdString(sub) || exp === undefined) {
    throw new UnauthorizedError();
  }
  return {
    subjectType: SUBJECT_BY_SCOPE[scope],
    subjectId: sub,
    scope,
    expiresAt: new Date(exp * MS_PER_SECOND),
  };
};
