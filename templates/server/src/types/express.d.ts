import type { Logger } from 'pino';
import type { MemberRole, Permission } from '../constants/enums';
import type { Language } from '../constants/i18n';
import type { AccessTokenClaims } from '../utils/auth/accessToken';
import type { MessageParams } from '../utils/errors';

declare global {
  namespace Express {
    interface Request {
      /** Request id; also returned to clients as `traceId` in error responses. */
      id: string;
      /** Child logger bound to the request id. */
      log: Logger;
      /** Language resolved from `Accept-Language` (default `ar`). */
      language: Language;
      /** Translates a locale key into the request language. */
      t: (key: string, params?: MessageParams) => string;
      /** Output of the `validate` middleware; read it through `validated()`. */
      validated: Record<string, unknown>;
      /** The JSON body exactly as received; kept for webhook routes, whose signature covers it. */
      rawBody?: string;
      /** Set by `requireAuth`: who is calling and in which namespace. */
      auth?: AccessTokenClaims;
      /** Set by `loadMember`: the signed-in merchant member with their effective permissions. */
      member?: {
        id: string;
        /** The merchant account the member belongs to (the owner's own id). */
        tenantId: string;
        role: MemberRole;
        permissions: readonly Permission[];
      };
    }
  }
}

export {};
