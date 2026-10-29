import { Router, type Request, type RequestHandler, type Response } from 'express';
import type { z } from 'zod';
import { toCustomerProfile } from '../../../domain/auth/customerAuth.service';
import type { UploadVerifier } from '../../../domain/uploads/uploads.service';
import { validate } from '../../../middlewares/validate';
import type { CustomersRepository } from '../../../repositories/identity.repository';
import { asyncHandler } from '../../../utils/async';
import { UnauthorizedError } from '../../../utils/errors';
import { sendSuccess } from '../../../utils/response/successResponse';
import { updateProfileSchema } from './profile.validation';

export interface CustomerProfileRouterOptions {
  readonly customers: Pick<CustomersRepository, 'findById' | 'patch'>;
  readonly uploads: Pick<UploadVerifier, 'assertConfirmed'>;
  readonly authenticate: RequestHandler;
  readonly limiter: RequestHandler;
}

/** `GET/PATCH /me`: the signed-in customer's own profile. */
export const createCustomerProfileRouter = (options: CustomerProfileRouterOptions): Router => {
  const router = Router();
  router.use(options.limiter, options.authenticate);
  router.get(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const customer = await options.customers.findById(req.auth?.subjectId ?? '');
      if (customer === null) throw new UnauthorizedError();
      sendSuccess(req, res, { data: toCustomerProfile(customer) });
    }),
  );
  router.patch(
    '/',
    validate({ body: updateProfileSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const id = req.auth?.subjectId ?? '';
      const body = (req.validated as { body: z.infer<typeof updateProfileSchema> }).body;
      if (body.avatarKey != null) {
        await options.uploads.assertConfirmed({
          keys: [body.avatarKey],
          purpose: 'CUSTOMER_AVATAR',
          field: 'body.avatarKey',
          accept: (upload) => upload.ownerType === 'CUSTOMER' && upload.ownerId === id,
        });
      }
      const set: Record<string, unknown> = {};
      const unset: string[] = [];
      if (body.name !== undefined) set['name'] = body.name;
      if (body.email === null) unset.push('email');
      else if (body.email !== undefined) set['email'] = body.email;
      if (body.avatarKey === null) unset.push('avatarKey');
      else if (body.avatarKey !== undefined) set['avatarKey'] = body.avatarKey;
      const updated = await options.customers.patch(id, { set, unset });
      if (updated === null) throw new UnauthorizedError();
      sendSuccess(req, res, { data: toCustomerProfile(updated) });
    }),
  );
  return router;
};
