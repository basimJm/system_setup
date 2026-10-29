import { Router, type Request, type RequestHandler, type Response } from 'express';
import type { z } from 'zod';
import { TEAM_ROUTES } from '../../../constants/team';
import type { TeamService } from '../../../domain/team/team.service';
import { requireOwner } from '../../../middlewares/permission';
import { validate } from '../../../middlewares/validate';
import type { MembersRepository } from '../../../repositories/identity.repository';
import { asyncHandler } from '../../../utils/async';
import { UnauthorizedError } from '../../../utils/errors';
import { sendCreated, sendSuccess } from '../../../utils/response/successResponse';
import { addMemberSchema, memberIdParams, updateMemberSchema } from './team.validation';

export interface TeamRouterOptions {
  readonly service: TeamService;
  readonly members: Pick<MembersRepository, 'findById'>;
  readonly guard: readonly RequestHandler[];
  readonly browseLimiter: RequestHandler;
  readonly writeLimiter: RequestHandler;
}

/** Owner-only: list, add and change staff of the merchant account. */
export const createTeamRouter = (options: TeamRouterOptions): Router => {
  const router = Router();
  const tenantOf = (req: Request): string => req.member?.tenantId ?? '';
  router.get(
    '/',
    options.browseLimiter,
    ...options.guard,
    requireOwner,
    asyncHandler(async (req: Request, res: Response) => {
      sendSuccess(req, res, { data: await options.service.list(tenantOf(req)) });
    }),
  );
  router.post(
    '/',
    options.writeLimiter,
    ...options.guard,
    requireOwner,
    validate({ body: addMemberSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const owner = await options.members.findById(req.member?.id ?? '');
      if (owner === null) throw new UnauthorizedError();
      const body = (req.validated as { body: z.infer<typeof addMemberSchema> }).body;
      const member = await options.service.add({
        ...body,
        tenantId: tenantOf(req),
        businessName: owner.businessName,
        language: req.language,
      });
      sendCreated(req, res, member);
    }),
  );
  router.patch(
    TEAM_ROUTES.byId,
    options.writeLimiter,
    ...options.guard,
    requireOwner,
    validate({ params: memberIdParams, body: updateMemberSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params, body } = req.validated as {
        params: z.infer<typeof memberIdParams>;
        body: z.infer<typeof updateMemberSchema>;
      };
      sendSuccess(req, res, {
        data: await options.service.update({
          tenantId: tenantOf(req),
          memberId: params.id,
          ...body,
        }),
      });
    }),
  );
  return router;
};
