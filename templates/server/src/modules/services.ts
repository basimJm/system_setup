import type { RequestHandler } from 'express';
import type { Store } from 'express-rate-limit';
import type { AdminAuthService } from '../domain/auth/adminAuth.service';
import type { AdminLoginService } from '../domain/auth/adminLogin.service';
import type { CustomerAuthService } from '../domain/auth/customerAuth.service';
import type { MerchantAuthService } from '../domain/auth/merchantAuth.service';
import type { ItemsService } from '../domain/items/items.service';
import type { InboxService } from '../domain/notifications/inbox.service';
import type { PhoneOtpService } from '../domain/otp/phoneOtp.service';
import type { SettingsService } from '../domain/settings';
import type { TeamService } from '../domain/team/team.service';
import type { UploadVerifier, UploadsService } from '../domain/uploads/uploads.service';
import type { AuditLogsRepository } from '../repositories/auditLogs.repository';
import type { AuditWriter } from '../domain/audit';
import type { CustomersRepository, MembersRepository } from '../repositories/identity.repository';
import type { PaymentProvider } from '../providers/payments';
import { ExternalServiceError } from '../utils/errors';

/**
 * Services the feature routers need, built once in `server.ts` after MongoDB and Redis are up.
 * Every field is optional so tests (and a half-wired app) can mount routers without the real
 * dependencies: a missing service answers 503 through `unavailable()`.
 */
export interface ApiServices {
  readonly phoneOtp?: PhoneOtpService;
  readonly customerAuth?: {
    readonly service: CustomerAuthService;
    /** `requireAuth('customer', secret)`. */
    readonly authenticate: RequestHandler;
  };
  readonly customers?: Pick<CustomersRepository, 'findById' | 'patch'>;
  readonly merchantAuth?: {
    readonly service: MerchantAuthService;
    /** `requireAuth('merchant', secret)` + `loadMember(...)`. */
    readonly guard: readonly RequestHandler[];
  };
  readonly members?: Pick<MembersRepository, 'findById'>;
  readonly team?: TeamService;
  readonly adminAuth?: { readonly service: AdminAuthService; readonly login: AdminLoginService };
  /** `requireAuth('admin', secret)`: every admin router except `/auth/*` is behind it. */
  readonly adminGuard?: RequestHandler;
  readonly audit?: AuditWriter;
  readonly auditLogs?: Pick<AuditLogsRepository, 'findPage'>;
  readonly settings?: SettingsService;
  readonly items?: ItemsService;
  readonly inbox?: InboxService;
  readonly uploads?: UploadsService & UploadVerifier;
  readonly payments?: PaymentProvider;
  /** Shared Redis counters per route family; in-memory per process when absent. */
  readonly rateLimitStoreFor?: (scope: string) => Store;
  readonly providersClose?: () => Promise<void>;
}

/** A service that is not wired: every call answers 503 instead of crashing or faking an answer. */
const UNAVAILABLE_HANDLER: ProxyHandler<object> = {
  get: () => () => Promise.reject(new ExternalServiceError({ unavailable: true })),
};
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- the caller names the port it stands in for
export const unavailable = <T extends object>(): T => new Proxy({}, UNAVAILABLE_HANDLER) as T;

/** A guard that is not wired: the route answers 503 rather than opening up. */
export const unavailableGuard: RequestHandler = (_req, _res, next) => {
  next(new ExternalServiceError({ unavailable: true }));
};
