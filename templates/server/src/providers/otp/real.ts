import type { Redis } from 'ioredis';
import type { OtpSettings } from '../../config';
import type { Logger } from '../../utils/logger';
import type { OtpChannel } from './core/channel';
import { createCodeOtp } from './core/codeFlow';
import { RedisCodeStore } from './core/store';
import type { OtpProvider } from './types';

export interface RealOtpDeps {
  readonly settings: OtpSettings;
  readonly redis: Redis;
  readonly logger: Logger;
  readonly isProduction: boolean;
}

/**
 * The production OTP provider = the in-repo code flow (HMAC codes in Redis, signed single-use
 * `otpToken`) over a real delivery channel. Plug the channel of the `__NPM_SCOPE__/otp` SDK (or any
 * vendor client) into `createRealOtpChannel`; until then `OTP_PROVIDER=real` fails at startup with
 * a clear message instead of silently sending nothing.
 */
export const createRealOtpChannel = (deps: RealOtpDeps): OtpChannel => {
  deps.logger.error({ provider: 'otp' }, 'real adapter not integrated');
  throw new Error(
    'OTP channel not integrated: implement createRealOtpChannel in src/providers/otp/real.ts (see src/providers/README.md)',
  );
};

export const createRealOtp = (deps: RealOtpDeps): OtpProvider => {
  const { codeSecret, proofSecret } = deps.settings;
  if (codeSecret === undefined || proofSecret === undefined) {
    throw new Error('OTP_CODE_SECRET and OTP_PROOF_SECRET are required for OTP_PROVIDER=real');
  }
  return createCodeOtp({
    isProduction: deps.isProduction,
    channel: createRealOtpChannel(deps),
    store: new RedisCodeStore(deps.redis),
    codeSecret,
    proofSecret,
    logger: deps.logger,
  });
};
