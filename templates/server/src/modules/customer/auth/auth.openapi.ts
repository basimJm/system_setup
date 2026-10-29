import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { CUSTOMER_AUTH_ROUTES } from '../../../constants/customerAuth';
import { JSON_CONTENT_TYPE } from '../../../constants/docs';
import { LANGUAGES } from '../../../constants/enums';
import { HTTP_STATUS } from '../../../constants/http';
import { API_PREFIXES } from '../../../constants/server';
import {
  acceptLanguageHeader,
  errorResponses,
  jsonResponse,
  successResponseSchema,
} from '../../../docs/schemas';
import { z } from '../../../docs/zod';
import {
  changePhoneSchema,
  checkPhoneSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
} from './auth.validation';

export const customerProfileSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    phone: z.string(),
    email: z.string().optional(),
    language: z.enum(LANGUAGES),
    avatarKey: z.string().optional(),
  })
  .openapi('CustomerProfile');

const sessionSchema = successResponseSchema(
  z.object({
    accessToken: z.string(),
    accessTokenExpiresAt: z.iso.datetime(),
    refreshToken: z.string().describe('Rotates on every refresh; keep only the newest.'),
    refreshTokenExpiresAt: z.iso.datetime(),
    customer: customerProfileSchema,
  }),
);
const emptySchema = successResponseSchema(z.null());
const profileResultSchema = successResponseSchema(z.object({ customer: customerProfileSchema }));

export const registerCustomerAuthDocs = (registry: OpenAPIRegistry): void => {
  const base = `${API_PREFIXES.customer}${CUSTOMER_AUTH_ROUTES.base}`;
  const headers = z.object({ 'Accept-Language': acceptLanguageHeader });
  const route = (
    path: string,
    summary: string,
    description: string,
    schema: z.ZodType,
    ok: { status: number; body: z.ZodType; label: string },
    statuses: number[],
    secured = false,
  ): void => {
    registry.registerPath({
      method: 'post',
      path: `${base}${path}`,
      tags: ['Auth'],
      summary,
      description,
      ...(secured ? {} : { security: [] }),
      request: {
        headers,
        body: { required: true, content: { [JSON_CONTENT_TYPE]: { schema } } },
      },
      responses: {
        [ok.status]: jsonResponse(ok.label, ok.body),
        ...errorResponses(HTTP_STATUS.badRequest, HTTP_STATUS.serviceUnavailable, ...statuses),
      },
    });
  };
  const ok = { status: HTTP_STATUS.ok, body: sessionSchema, label: 'Session' };
  route(
    CUSTOMER_AUTH_ROUTES.checkPhone,
    'Check a number before sending the OTP',
    'LOGIN: 404 `PHONE_NOT_REGISTERED`, 403 `ACCOUNT_BLOCKED`. REGISTER: 409 `PHONE_ALREADY_REGISTERED`.',
    checkPhoneSchema,
    { status: HTTP_STATUS.ok, body: emptySchema, label: 'The number can be used' },
    [HTTP_STATUS.forbidden, HTTP_STATUS.notFound, HTTP_STATUS.conflict],
  );
  route(
    CUSTOMER_AUTH_ROUTES.login,
    'Log in with an otpToken',
    '`otpToken` = the single-use proof from `POST /auth/otp/verify` (purpose LOGIN) for this phone. Errors: `OTP_INVALID`, `OTP_EXPIRED` (401), `OTP_BLOCKED` (429), `ACCOUNT_BLOCKED` (403), `PHONE_NOT_REGISTERED` (404).',
    loginSchema,
    ok,
    [
      HTTP_STATUS.unauthorized,
      HTTP_STATUS.forbidden,
      HTTP_STATUS.notFound,
      HTTP_STATUS.tooManyRequests,
    ],
  );
  route(
    CUSTOMER_AUTH_ROUTES.register,
    'Register with an otpToken',
    'Creates the account and signs it in. `otpToken` from `POST /auth/otp/verify` (purpose REGISTER), single use. Errors: `OTP_INVALID`, `OTP_EXPIRED`, `OTP_BLOCKED`, `PHONE_ALREADY_REGISTERED` (409).',
    registerSchema,
    { ...ok, status: HTTP_STATUS.created },
    [HTTP_STATUS.unauthorized, HTTP_STATUS.conflict, HTTP_STATUS.tooManyRequests],
  );
  route(
    CUSTOMER_AUTH_ROUTES.refresh,
    'Rotate the refresh token',
    'Returns a new access and refresh token. Reusing an old refresh token ends every session of that login (401).',
    refreshSchema,
    ok,
    [HTTP_STATUS.unauthorized, HTTP_STATUS.forbidden],
  );
  route(
    CUSTOMER_AUTH_ROUTES.logout,
    'Log out',
    'Revokes the refresh token and forgets the device push token. Always succeeds for well-formed tokens.',
    refreshSchema,
    { status: HTTP_STATUS.ok, body: emptySchema, label: 'Logged out' },
    [],
  );
  route(
    CUSTOMER_AUTH_ROUTES.changePhone,
    'Change the phone number',
    'Needs an `otpToken` (purpose CHANGE_PHONE) of the NEW number. Errors: `OTP_INVALID`, `OTP_EXPIRED`, `OTP_BLOCKED`, `PHONE_ALREADY_REGISTERED`.',
    changePhoneSchema,
    { status: HTTP_STATUS.ok, body: profileResultSchema, label: 'Updated profile' },
    [HTTP_STATUS.unauthorized, HTTP_STATUS.conflict, HTTP_STATUS.tooManyRequests],
    true,
  );
};
