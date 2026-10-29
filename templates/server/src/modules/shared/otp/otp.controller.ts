import type { Request, Response } from 'express';
import type { OtpPurpose } from '../../../constants/providers';
import type { PhoneOtpService } from '../../../domain/otp/phoneOtp.service';
import { sendSuccess } from '../../../utils/response/successResponse';

interface OtpBody {
  readonly phone: string;
  readonly purpose: OtpPurpose;
  readonly code?: string;
}

const bodyOf = (req: Request): OtpBody => (req.validated as { body: OtpBody }).body;

/** Thin handlers: validated body in, one service call, base success envelope out. */
export const createOtpController = (
  service: PhoneOtpService,
): {
  request: (req: Request, res: Response) => Promise<void>;
  verify: (req: Request, res: Response) => Promise<void>;
} => ({
  async request(req: Request, res: Response): Promise<void> {
    const { phone, purpose } = bodyOf(req);
    // `req.ip` honours TRUST_PROXY_HOPS (the client behind the load balancer).
    const answer = await service.request({
      phone,
      purpose,
      language: req.language,
      ...(req.ip === undefined ? {} : { ip: req.ip }),
    });
    sendSuccess(req, res, {
      data: {
        allowed: answer.allowed,
        otpLength: answer.otpLength,
        resendAfterSeconds: answer.resendAfterSeconds,
        expiresInSeconds: answer.expiresInSeconds,
        ...(answer.blockedUntil === undefined
          ? {}
          : { blockedUntil: answer.blockedUntil.toISOString() }),
      },
    });
  },

  async verify(req: Request, res: Response): Promise<void> {
    const { phone, purpose, code = '' } = bodyOf(req);
    const verified = await service.verify({ phone, purpose, code });
    sendSuccess(req, res, {
      data: { otpToken: verified.otpToken, expiresInSeconds: verified.expiresInSeconds },
    });
  },
});
