import { randomBytes } from 'node:crypto';
import { OTP_GENERATED_SECRET_BYTES } from '../../constants/otp';
import type { OtpPurpose } from '../../constants/providers';
import type { Logger } from '../../utils/logger';
import { FakeOtpChannel } from './core/channel';
import { createCodeOtp } from './core/codeFlow';
import { createProofs } from './core/proofs';
import { MemoryCodeStore, type CodeStore } from './core/store';
import type { OtpProvider } from './types';

export interface FakeOtpOptions {
  /** Development only: every code is this value, so local QA can sign in without a channel. */
  readonly fixedCode?: string;
  /** Shared store (Redis) in a running dev server; memory by default (unit tests). */
  readonly store?: CodeStore;
  /** Missing secrets are generated per process (proofs then die with the process). */
  readonly codeSecret?: string;
  readonly proofSecret?: string;
  readonly logger?: Logger;
  readonly now?: () => Date;
}

const generatedSecret = (): string => randomBytes(OTP_GENERATED_SECRET_BYTES).toString('base64url');

/**
 * The real code flow (HMAC store, single use, signed `otpToken`) over a channel that records codes
 * instead of sending them (dev/test only; production config refuses it).
 */
export class FakeOtpProvider implements OtpProvider {
  /** What would have been delivered: `channel.lastCode(phone)` is what the user would type. */
  readonly channel = new FakeOtpChannel();
  readonly store: CodeStore;
  private readonly proofSecret: string;
  private readonly now: (() => Date) | undefined;
  private readonly flow: OtpProvider;

  constructor(options: FakeOtpOptions = {}) {
    this.store = options.store ?? new MemoryCodeStore();
    this.proofSecret = options.proofSecret ?? generatedSecret();
    this.now = options.now;
    this.flow = createCodeOtp({
      isProduction: false,
      channel: this.channel,
      store: this.store,
      codeSecret: options.codeSecret ?? generatedSecret(),
      proofSecret: this.proofSecret,
      ...(options.fixedCode === undefined ? {} : { fixedCode: options.fixedCode }),
      ...(options.logger === undefined ? {} : { logger: options.logger }),
      ...(options.now === undefined ? {} : { now: options.now }),
    });
  }

  sendCode: OtpProvider['sendCode'] = (input, rules) => this.flow.sendCode(input, rules);
  verifyCode: OtpProvider['verifyCode'] = (input, rules) => this.flow.verifyCode(input, rules);
  verify: OtpProvider['verify'] = (input) => this.flow.verify(input);

  /** Tests: an `otpToken` exactly as `POST …/auth/otp/verify` would issue it (optionally back-dated). */
  issueToken(
    phone: string,
    purpose: OtpPurpose,
    options: { readonly ttlSec?: number; readonly issuedAt?: Date } = {},
  ): string {
    const { ttlSec = DEFAULT_TEST_PROOF_TTL_SEC, issuedAt } = options;
    const now = issuedAt === undefined ? this.now : (): Date => issuedAt;
    return createProofs({
      secret: this.proofSecret,
      store: this.store,
      ttlSec,
      ...(now === undefined ? {} : { now }),
    }).issue({ phone, purpose }).otpToken;
  }
}

const DEFAULT_TEST_PROOF_TTL_SEC = 600;
