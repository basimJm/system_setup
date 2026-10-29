import type { Request, Response } from 'express';
import type { z } from 'zod';
import type { AdminAuthService, AdminSession } from '../../../domain/auth/adminAuth.service';
import type { AdminLoginService } from '../../../domain/auth/adminLogin.service';
import { sendSuccess } from '../../../utils/response/successResponse';
import type { loginSchema, refreshSchema, verifyOtpSchema } from './auth.validation';

const bodyOf = <S extends z.ZodType>(req: Request): z.infer<S> =>
  (req.validated as { body: z.infer<S> }).body;

type Handler = (req: Request, res: Response) => Promise<void>;

export const sessionData = (session: AdminSession): Record<string, unknown> => ({
  accessToken: session.accessToken,
  accessTokenExpiresAt: session.accessTokenExpiresAt.toISOString(),
  refreshToken: session.refreshToken,
  refreshTokenExpiresAt: session.refreshTokenExpiresAt.toISOString(),
  admin: session.admin,
});

/** Thin handlers: validated body in, one service call, base envelope out. */
export const createAdminAuthController = (
  service: AdminAuthService,
  login: AdminLoginService,
): Record<'login' | 'verifyOtp' | 'refresh' | 'logout', Handler> => ({
  async login(req, res) {
    const { email, password } = bodyOf<typeof loginSchema>(req);
    const challenge = await login.start({
      email,
      password,
      ip: req.ip ?? '',
      language: req.language,
    });
    sendSuccess(req, res, {
      data: {
        otpRequired: true,
        expiresAt: challenge.expiresAt.toISOString(),
        resendAfterSeconds: challenge.resendAfterSeconds,
      },
    });
  },

  async verifyOtp(req, res) {
    const { email, code } = bodyOf<typeof verifyOtpSchema>(req);
    const session = await login.verify({ email, code, ip: req.ip ?? '', language: req.language });
    sendSuccess(req, res, { data: sessionData(session) });
  },

  async refresh(req, res) {
    sendSuccess(req, res, {
      data: sessionData(await service.refresh(bodyOf<typeof refreshSchema>(req))),
    });
  },

  async logout(req, res) {
    await service.logout(bodyOf<typeof refreshSchema>(req));
    sendSuccess(req, res);
  },
});
