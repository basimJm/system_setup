import { Router, type Request, type RequestHandler, type Response } from 'express';
import { toMemberProfile } from '../../../domain/auth/merchantAuth.service';
import type { MembersRepository } from '../../../repositories/identity.repository';
import { asyncHandler } from '../../../utils/async';
import { UnauthorizedError } from '../../../utils/errors';
import { sendSuccess } from '../../../utils/response/successResponse';

export interface MerchantMeRouterOptions {
  readonly members: Pick<MembersRepository, 'findById'>;
  readonly guard: readonly RequestHandler[];
  readonly limiter: RequestHandler;
}

/** `GET /me`: the signed-in member with their effective permissions (the app refreshes from it). */
export const createMerchantMeRouter = (options: MerchantMeRouterOptions): Router => {
  const router = Router();
  router.get(
    '/',
    options.limiter,
    ...options.guard,
    asyncHandler(async (req: Request, res: Response) => {
      const member = await options.members.findById(req.member?.id ?? '');
      if (member === null) throw new UnauthorizedError();
      sendSuccess(req, res, { data: toMemberProfile(member) });
    }),
  );
  return router;
};
