import type { Request, Response } from 'express';
import type { z } from 'zod';
import type {
  MerchantAuthService,
  MerchantSession,
} from '../../../domain/auth/merchantAuth.service';
import { sendCreated, sendSuccess } from '../../../utils/response/successResponse';
import type {
  checkPhoneSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
} from './auth.validation';

const bodyOf = <S extends z.ZodType>(req: Request): z.infer<S> =>
  (req.validated as { body: z.infer<S> }).body;

export const sessionData = (session: MerchantSession): Record<string, unknown> => ({
  accessToken: session.accessToken,
  accessTokenExpiresAt: session.accessTokenExpiresAt.toISOString(),
  refreshToken: session.refreshToken,
  refreshTokenExpiresAt: session.refreshTokenExpiresAt.toISOString(),
  member: session.member,
});

type Handler = (req: Request, res: Response) => Promise<void>;

export const createMerchantAuthController = (
  service: MerchantAuthService,
): Record<'checkPhone' | 'register' | 'login' | 'refresh' | 'logout', Handler> => ({
  async checkPhone(req, res) {
    await service.checkPhone(bodyOf<typeof checkPhoneSchema>(req));
    sendSuccess(req, res);
  },
  async register(req, res) {
    const session = await service.register({
      ...bodyOf<typeof registerSchema>(req),
      language: req.language,
    });
    sendCreated(req, res, sessionData(session));
  },
  async login(req, res) {
    const session = await service.login({
      ...bodyOf<typeof loginSchema>(req),
      language: req.language,
    });
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
