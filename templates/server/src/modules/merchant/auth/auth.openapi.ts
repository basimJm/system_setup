import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { JSON_CONTENT_TYPE } from '../../../constants/docs';
import { LANGUAGES, MEMBER_ROLES, PERMISSIONS } from '../../../constants/enums';
import { HTTP_STATUS } from '../../../constants/http';
import { MERCHANT_AUTH_ROUTES } from '../../../constants/merchantAuth';
import { API_PREFIXES } from '../../../constants/server';
import {
  acceptLanguageHeader,
  errorResponses,
  jsonResponse,
  successResponseSchema,
} from '../../../docs/schemas';
import { z } from '../../../docs/zod';
import { checkPhoneSchema, loginSchema, refreshSchema, registerSchema } from './auth.validation';

export const memberProfileSchema = z
  .object({
    id: z.string(),
    tenantId: z.string().describe('The merchant account; items and team are scoped by it.'),
    businessName: z.string(),
    name: z.string(),
    phone: z.string(),
    role: z.enum(MEMBER_ROLES),
    permissions: z.array(z.enum(PERMISSIONS)).describe('Effective permissions; the OWNER has all.'),
    active: z.boolean(),
    language: z.enum(LANGUAGES),
    photoKey: z.string().optional(),
  })
  .openapi('MemberProfile');

const sessionSchema = successResponseSchema(
  z.object({
    accessToken: z.string(),
    accessTokenExpiresAt: z.iso.datetime(),
    refreshToken: z.string().describe('Rotates on every refresh; keep only the newest.'),
    refreshTokenExpiresAt: z.iso.datetime(),
    member: memberProfileSchema,
  }),
);
const emptySchema = successResponseSchema(z.null());

export const registerMerchantAuthDocs = (registry: OpenAPIRegistry): void => {
  const base = `${API_PREFIXES.merchant}${MERCHANT_AUTH_ROUTES.base}`;
  const headers = z.object({ 'Accept-Language': acceptLanguageHeader });
  const route = (
    path: string,
    summary: string,
    description: string,
    schema: z.ZodType,
    ok: { status: number; body: z.ZodType; label: string },
    statuses: number[],
  ): void => {
    registry.registerPath({
      method: 'post',
      path: `${base}${path}`,
      tags: ['Auth'],
      summary,
      description,
      security: [],
      request: { headers, body: { required: true, content: { [JSON_CONTENT_TYPE]: { schema } } } },
      responses: {
        [ok.status]: jsonResponse(ok.label, ok.body),
        ...errorResponses(HTTP_STATUS.badRequest, HTTP_STATUS.serviceUnavailable, ...statuses),
      },
    });
  };
  const ok = { status: HTTP_STATUS.ok, body: sessionSchema, label: 'Session' };
  route(
    MERCHANT_AUTH_ROUTES.checkPhone,
    'Check a number before sending the OTP',
    'LOGIN: 404 `PHONE_NOT_REGISTERED`, 403 `MEMBER_INACTIVE`. REGISTER: 409 `PHONE_ALREADY_REGISTERED`.',
    checkPhoneSchema,
    { status: HTTP_STATUS.ok, body: emptySchema, label: 'The number can be used' },
    [HTTP_STATUS.forbidden, HTTP_STATUS.notFound, HTTP_STATUS.conflict],
  );
  route(
    MERCHANT_AUTH_ROUTES.register,
    'Open a merchant account (the caller becomes its OWNER)',
    '`otpToken` from `POST /auth/otp/verify` (purpose REGISTER). Errors: `OTP_INVALID`, `OTP_EXPIRED` (401), `OTP_BLOCKED` (429), `PHONE_ALREADY_REGISTERED` (409).',
    registerSchema,
    { ...ok, status: HTTP_STATUS.created },
    [HTTP_STATUS.unauthorized, HTTP_STATUS.conflict, HTTP_STATUS.tooManyRequests],
  );
  route(
    MERCHANT_AUTH_ROUTES.login,
    'Log in with an otpToken',
    'Staff are added by the owner first. Errors: `OTP_INVALID`, `OTP_EXPIRED` (401), `OTP_BLOCKED` (429), `MEMBER_INACTIVE` (403), `PHONE_NOT_REGISTERED` (404).',
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
    MERCHANT_AUTH_ROUTES.refresh,
    'Rotate the refresh token',
    'Reusing an old refresh token ends every session of that login (401); a deactivated member gets 403.',
    refreshSchema,
    ok,
    [HTTP_STATUS.unauthorized, HTTP_STATUS.forbidden],
  );
  route(
    MERCHANT_AUTH_ROUTES.logout,
    'Log out',
    'Revokes the refresh token and forgets the device push token.',
    refreshSchema,
    { status: HTTP_STATUS.ok, body: emptySchema, label: 'Logged out' },
    [],
  );
};
