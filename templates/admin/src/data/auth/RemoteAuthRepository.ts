import type { ApiClient } from '@/data/api/ApiClient';
import { defineEndpoint } from '@/data/api/endpoint';
import {
  postAuthLoginBodySchema,
  postAuthLoginDataSchema,
  postAuthLogoutBodySchema,
  postAuthLogoutDataSchema,
  postAuthRefreshBodySchema,
  postAuthRefreshDataSchema,
  postAuthVerifyOtpBodySchema,
  postAuthVerifyOtpDataSchema,
  type postAuthVerifyOtpData,
} from '@/data/contract/generated/dto';
import { OPERATIONS } from '@/data/contract/generated/operations';
import type { AuthRepository, LoginChallenge, Session } from '@/domain/auth/auth';

const SESSION_LESS = { noRefresh: true } as const;
const loginEndpoint = defineEndpoint(
  OPERATIONS.postAuthLogin,
  { data: postAuthLoginDataSchema, body: postAuthLoginBodySchema },
  SESSION_LESS,
);
const verifyEndpoint = defineEndpoint(
  OPERATIONS.postAuthVerifyOtp,
  { data: postAuthVerifyOtpDataSchema, body: postAuthVerifyOtpBodySchema },
  SESSION_LESS,
);
const refreshEndpoint = defineEndpoint(
  OPERATIONS.postAuthRefresh,
  { data: postAuthRefreshDataSchema, body: postAuthRefreshBodySchema },
  SESSION_LESS,
);
const logoutEndpoint = defineEndpoint(
  OPERATIONS.postAuthLogout,
  { data: postAuthLogoutDataSchema, body: postAuthLogoutBodySchema },
  SESSION_LESS,
);

/** Maps the server's token answer (verify-otp and refresh share it) to the in-memory session. */
export const sessionFromTokens = (data: postAuthVerifyOtpData): Session => ({
  accessToken: data.accessToken,
  admin: { id: data.admin.id, email: data.admin.email, name: data.admin.email },
  accessExpiresAt: Date.parse(data.accessTokenExpiresAt),
  refreshToken: data.refreshToken,
  refreshExpiresAt: Date.parse(data.refreshTokenExpiresAt),
});

export class RemoteAuthRepository implements AuthRepository {
  constructor(private readonly api: ApiClient) {}

  async login(email: string, password: string): Promise<LoginChallenge> {
    const { data } = await this.api.execute(loginEndpoint, { body: { email, password } });
    return {
      otpRequired: data.otpRequired,
      expiresAt: Date.parse(data.expiresAt),
      resendAfterSeconds: data.resendAfterSeconds,
    };
  }

  async verifyOtp(email: string, code: string): Promise<Session> {
    const { data } = await this.api.execute(verifyEndpoint, { body: { email, code } });
    return sessionFromTokens(data);
  }

  async refresh(refreshToken: string): Promise<Session> {
    const { data } = await this.api.execute(refreshEndpoint, { body: { refreshToken } });
    return sessionFromTokens(data);
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    await this.api.execute(logoutEndpoint, { body: { refreshToken } });
  }
}
