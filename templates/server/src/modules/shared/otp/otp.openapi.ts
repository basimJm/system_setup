import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { JSON_CONTENT_TYPE } from '../../../constants/docs';
import { HTTP_STATUS } from '../../../constants/http';
import { OTP_ROUTES } from '../../../constants/otp';
import { API_PREFIXES, type ApiNamespace } from '../../../constants/server';
import {
  acceptLanguageHeader,
  errorResponses,
  jsonResponse,
  successResponseSchema,
} from '../../../docs/schemas';
import { z } from '../../../docs/zod';
import { CUSTOMER_OTP_SCHEMAS, MERCHANT_OTP_SCHEMAS, type OtpSchemas } from './otp.validation';

const decisionSchema = successResponseSchema(
  z.object({
    allowed: z
      .boolean()
      .describe('A new code was sent. `false` = blocked or resend countdown running.'),
    otpLength: z.number().int().describe('Number of code boxes; never hardcode it in the app.'),
    resendAfterSeconds: z.number().int().describe('Resend countdown in seconds.'),
    expiresInSeconds: z
      .number()
      .int()
      .describe('Lifetime of the code just sent (`otp.codeTtlSec`); 0 when no code was sent.'),
    blockedUntil: z.iso.datetime().optional().describe('Set while the phone is blocked (UTC).'),
  }),
);

const verifiedSchema = successResponseSchema(
  z.object({
    otpToken: z
      .string()
      .describe(
        'Signed single-use proof for this phone and purpose. Send it as `otpToken` to the action of that purpose (login, register, change phone).',
      ),
    expiresInSeconds: z
      .number()
      .int()
      .describe('Lifetime of `otpToken` (`otp.proofTtlSec`); ask for a new code after it.'),
  }),
);

const register = (
  registry: OpenAPIRegistry,
  namespace: ApiNamespace,
  schemas: OtpSchemas,
): void => {
  const base = `${API_PREFIXES[namespace]}${OTP_ROUTES.base}`;
  const headers = z.object({ 'Accept-Language': acceptLanguageHeader });
  registry.registerPath({
    method: 'post',
    path: `${base}${OTP_ROUTES.request}`,
    tags: ['Auth'],
    summary: 'Send an OTP code',
    description:
      'Public. The platform limits run first (`otp.maxRequests` per `otp.requestWindowSec`, resend after `otp.resendAfterSec`, block for `otp.blockSec`); then the server sends a new code in the `Accept-Language` language. A blocked phone or a running resend countdown answers 200 with `allowed: false` and sends nothing. A number the channel cannot reach answers 422 `OTP_DELIVERY_FAILED` (the request still counts). A channel outage answers 503 `INTERNAL`.',
    security: [],
    request: {
      headers,
      body: { required: true, content: { [JSON_CONTENT_TYPE]: { schema: schemas.request } } },
    },
    responses: {
      [HTTP_STATUS.ok]: jsonResponse('Decision', decisionSchema),
      ...errorResponses(
        HTTP_STATUS.badRequest,
        HTTP_STATUS.unprocessableEntity,
        HTTP_STATUS.tooManyRequests,
        HTTP_STATUS.serviceUnavailable,
      ),
    },
  });
  registry.registerPath({
    method: 'post',
    path: `${base}${OTP_ROUTES.verify}`,
    tags: ['Auth'],
    summary: 'Check the typed code and get an otpToken',
    description:
      'Public. The right code (for this phone and purpose) is used up and answers `otpToken`. Errors: 401 `OTP_INVALID` (wrong code; `details[0].message` says how many attempts are left; the last wrong code blocks), 401 `OTP_EXPIRED` (no code, expired or already used: request a new one), 429 `OTP_BLOCKED`.',
    security: [],
    request: {
      headers,
      body: { required: true, content: { [JSON_CONTENT_TYPE]: { schema: schemas.verify } } },
    },
    responses: {
      [HTTP_STATUS.ok]: jsonResponse('Verified', verifiedSchema),
      ...errorResponses(
        HTTP_STATUS.badRequest,
        HTTP_STATUS.unauthorized,
        HTTP_STATUS.tooManyRequests,
        HTTP_STATUS.serviceUnavailable,
      ),
    },
  });
};

export const registerCustomerOtpDocs = (registry: OpenAPIRegistry): void => {
  register(registry, 'customer', CUSTOMER_OTP_SCHEMAS);
};
export const registerMerchantOtpDocs = (registry: OpenAPIRegistry): void => {
  register(registry, 'merchant', MERCHANT_OTP_SCHEMAS);
};
