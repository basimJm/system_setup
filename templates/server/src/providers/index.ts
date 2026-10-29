import type { Redis } from 'ioredis';
import type { AppConfig } from '../config';
import { DISABLED_PAYMENT_MODE, REAL_PROVIDER_MODE } from '../constants/providers';
import type { ServerEvents } from '../domain/events';
import { InternalError } from '../utils/errors';
import type { Logger } from '../utils/logger';
import {
  createMongoAnalytics,
  FakeAnalyticsProvider,
  type AnalyticsProvider,
  type EventCounter,
} from './analytics';
import { FakeNotifier, type Notifier } from './notifier';
import { createRealNotifier, type ClosableNotifier } from './notifier/real';
import { createRealOtp, FakeOtpProvider, RedisCodeStore, type OtpProvider } from './otp';
import {
  createRealPayments,
  DisabledPaymentProvider,
  FakePaymentProvider,
  type PaymentProvider,
} from './payments';
import { FakeStorageProvider, type StorageProvider } from './storage';
import { createRealStorage } from './storage/real';

/** What the real integrations need from the running process. */
export interface ProviderDeps {
  readonly redis: Redis;
  readonly logger: Logger;
  readonly config: AppConfig;
  /** Server events in MongoDB: the `real` analytics provider counts them. */
  readonly serverEvents?: { readonly events: ServerEvents; readonly counter: EventCounter };
}

export interface Providers {
  readonly otp: OtpProvider;
  readonly storage: StorageProvider;
  readonly notifier: Notifier;
  readonly payments: PaymentProvider;
  readonly analytics: AnalyticsProvider;
  /** Releases provider connections on shutdown. */
  readonly close: () => Promise<void>;
}

/** The configured provider cannot be built: not integrated yet, or a fake in production. */
export class ProviderUnavailableError extends InternalError {
  constructor(
    readonly provider: string,
    reason: string,
  ) {
    super();
    this.message = `${provider} provider unavailable: ${reason}`;
  }
}

type Mode = AppConfig['providers'][keyof AppConfig['providers']];

/**
 * Builds the providers named by the config. Fakes are for development and tests only: they are
 * refused in production even if the config check was bypassed. `real` providers are the adapters
 * in `src/providers/<name>/real.ts` (see `src/providers/README.md`) and fail loudly until built.
 */
export const createProviders = (
  providers: AppConfig['providers'],
  isProduction: boolean,
  deps?: ProviderDeps,
): Providers => {
  const closers: (() => Promise<void>)[] = [];
  const runtime = (name: string): ProviderDeps => {
    if (deps === undefined)
      throw new ProviderUnavailableError(name, 'runtime dependencies missing');
    return deps;
  };
  const pick = <T>(name: string, mode: Mode, fake: () => T, real: () => T): T => {
    if (mode === REAL_PROVIDER_MODE) {
      try {
        return real();
      } catch (error) {
        throw new ProviderUnavailableError(name, error instanceof Error ? error.message : 'failed');
      }
    }
    if (isProduction)
      throw new ProviderUnavailableError(name, 'fakes are not allowed in production');
    return fake();
  };
  const pickPayments = (mode: AppConfig['providers']['payments']): PaymentProvider => {
    if (mode === DISABLED_PAYMENT_MODE) return new DisabledPaymentProvider();
    return pick(
      'payments',
      mode,
      () => new FakePaymentProvider(),
      () => {
        const { logger } = runtime('payments');
        return createRealPayments({ logger, isProduction });
      },
    );
  };
  const built = {
    otp: pick(
      'otp',
      providers.otp,
      () => {
        if (deps === undefined) return new FakeOtpProvider();
        const { codeSecret, proofSecret, fixedCode } = deps.config.otp;
        return new FakeOtpProvider({
          store: new RedisCodeStore(deps.redis),
          logger: deps.logger,
          ...(codeSecret === undefined ? {} : { codeSecret }),
          ...(proofSecret === undefined ? {} : { proofSecret }),
          ...(fixedCode === undefined ? {} : { fixedCode }),
        });
      },
      () => {
        const { config, redis, logger } = runtime('otp');
        return createRealOtp({ settings: config.otp, redis, logger, isProduction });
      },
    ),
    storage: pick(
      'storage',
      providers.storage,
      () => new FakeStorageProvider(),
      () => createRealStorage({ logger: runtime('storage').logger, isProduction }),
    ),
    notifier: pick(
      'notifier',
      providers.notifier,
      (): Notifier => new FakeNotifier(),
      (): Notifier => {
        const real: ClosableNotifier = createRealNotifier({
          logger: runtime('notifier').logger,
          isProduction,
        });
        closers.push(() => real.close());
        return real;
      },
    ),
    analytics: pick(
      'analytics',
      providers.analytics,
      (): AnalyticsProvider => new FakeAnalyticsProvider(),
      (): AnalyticsProvider => {
        const events = runtime('analytics').serverEvents;
        if (events === undefined) throw new Error('server events store missing');
        return createMongoAnalytics(events);
      },
    ),
    payments: pickPayments(providers.payments),
  };
  return {
    ...built,
    close: async () => {
      await Promise.all(closers.map((close) => close()));
    },
  };
};

export type { AnalyticsProvider, Notifier, OtpProvider, PaymentProvider, StorageProvider };
