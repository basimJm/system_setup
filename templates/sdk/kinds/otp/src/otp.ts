import { createHash } from 'node:crypto';
import { FakeOtpChannel } from './adapters/fake-channel';
import { MemoryCodeStore } from './adapters/memory-store';
import { resolveConfig, type OtpOptions, type ResolvedConfig } from './config/options';
import { SDK_NAME } from './constants/defaults';
import { configError } from './errors';
import { OtpService } from './service';
import type { CodeStore, OtpChannel } from './types';

/** An `OtpProvider` plus the store and channel it runs on (the fake channel exposes the codes). */
export interface Otp extends OtpService {
  readonly store: CodeStore;
  readonly channel: OtpChannel;
}

class BoundOtp extends OtpService implements Otp {
  constructor(
    config: ResolvedConfig,
    readonly store: CodeStore,
    readonly channel: OtpChannel,
    secret: string,
  ) {
    super(config, { store, channel, secret });
  }
}

/** Dev-only secret for the fake provider: deterministic per process, never for production. */
const fakeSecret = (): string => createHash('sha256').update(`${SDK_NAME}:fake`).digest('hex');

/** The factory: `fake` = memory store + fake channel; `code` = the injected store + channel. */
export const createOtp = (options: OtpOptions): Otp => {
  const config = resolveConfig(options);
  if (config.provider === 'fake')
    return new BoundOtp(
      config,
      config.store ?? new MemoryCodeStore(config.now),
      config.channel ?? new FakeOtpChannel(),
      config.secret ?? fakeSecret(),
    );
  /* istanbul ignore next -- resolveConfig already guarantees them; kept for the type checker */
  if (!config.store || !config.channel || config.secret === undefined)
    throw configError('store, channel and secret are required', {
      fields: ['store', 'channel', 'secret'],
    });
  return new BoundOtp(config, config.store, config.channel, config.secret);
};
