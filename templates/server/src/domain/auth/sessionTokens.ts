import type { SubjectType } from '../../constants/enums';
import { signAccessToken } from '../../utils/auth/accessToken';
import type { SettingsService } from '../settings';
import type { RefreshLifetime, RefreshTokenService } from './refreshTokens.service';

export interface TokenPair {
  readonly accessToken: string;
  readonly accessTokenExpiresAt: Date;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: Date;
}

export interface RotatedTokens {
  readonly subjectType: SubjectType;
  readonly subjectId: string;
  readonly installationId?: string;
  readonly tokens: TokenPair;
}

export interface SessionTokens {
  /** A new login: a fresh refresh-token family plus an access token. */
  open(subjectType: SubjectType, subjectId: string, installationId?: string): Promise<TokenPair>;
  /** A refresh: rotates the token (reuse ends the family, 401) and signs a new access token. */
  rotate(refreshToken: string): Promise<RotatedTokens>;
}

export interface SessionTokensDeps {
  readonly refreshTokens: RefreshTokenService;
  readonly settings: Pick<SettingsService, 'get'>;
  readonly accessSecret: string;
  readonly now?: () => Date;
  /** Refresh-token lifetime; defaults to `auth.refreshTokenTtlDays`. The admin panel uses its idle timeout. */
  readonly refreshLifetime?: () => Promise<RefreshLifetime>;
}

/** Issues the platform's access + refresh token pair; lifetimes come from the settings. */
export const createSessionTokens = ({
  refreshTokens,
  settings,
  accessSecret,
  now = () => new Date(),
  refreshLifetime = async (): Promise<RefreshLifetime> => ({
    ttlDays: await settings.get('auth.refreshTokenTtlDays'),
  }),
}: SessionTokensDeps): SessionTokens => {
  const lifetimes = (): Promise<[number, RefreshLifetime]> =>
    Promise.all([settings.get('auth.accessTokenTtlSec'), refreshLifetime()]);

  const pair = (
    subjectType: SubjectType,
    subjectId: string,
    refresh: { token: string; expiresAt: Date },
    accessTtlSec: number,
  ): TokenPair => {
    const access = signAccessToken({
      secret: accessSecret,
      subjectType,
      subjectId,
      ttlSec: accessTtlSec,
      now: now(),
    });
    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt,
    };
  };

  return {
    async open(subjectType, subjectId, installationId) {
      const [accessTtlSec, lifetime] = await lifetimes();
      const refresh = await refreshTokens.issue({
        subjectType,
        subjectId,
        ...(installationId === undefined ? {} : { installationId }),
        ...lifetime,
      });
      return pair(subjectType, subjectId, refresh, accessTtlSec);
    },

    async rotate(refreshToken) {
      const [accessTtlSec, lifetime] = await lifetimes();
      const next = await refreshTokens.rotate({ token: refreshToken, ...lifetime });
      return {
        subjectType: next.subjectType,
        subjectId: next.subjectId,
        ...(next.installationId === undefined ? {} : { installationId: next.installationId }),
        tokens: pair(next.subjectType, next.subjectId, next, accessTtlSec),
      };
    },
  };
};
