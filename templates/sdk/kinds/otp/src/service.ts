import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { MS_PER_SECOND } from './constants/defaults';
import { ERROR_CODES, KEYS, KEY_SEPARATOR, TOKEN_BYTES } from './constants/otp';
import type { ResolvedConfig } from './config/options';
import { SdkError, isSdkError } from './errors';
import type {
  CodeStore,
  ConsumeInput,
  ConsumeResult,
  OtpChannel,
  OtpProvider,
  RequestInput,
  RequestResult,
  VerifyInput,
  VerifyResult,
} from './types';
import {
  assertCode,
  assertLanguage,
  assertPhone,
  assertPurpose,
  assertToken,
  maskPhone,
} from './validation';

interface CodeRecord {
  readonly hash: string;
  readonly expiresAt: number;
}
interface TokenRecord {
  readonly phone: string;
  readonly purpose: string;
}

export interface ServiceDeps {
  readonly store: CodeStore;
  readonly channel: OtpChannel;
  readonly secret: string;
  /** Code generator (injectable for tests); defaults to CSPRNG digits. */
  readonly generateCode?: (length: number) => string;
}

export const randomDigits = (length: number): string =>
  Array.from({ length }, () => String(randomInt(10))).join('');

const secondsUp = (ms: number): number => Math.max(1, Math.ceil(ms / MS_PER_SECOND));

/** Request → verify → consume, with cooldown, request window, wrong-code limit and blocks. */
export class OtpService implements OtpProvider {
  private readonly generateCode: (length: number) => string;

  constructor(
    private readonly config: ResolvedConfig,
    private readonly deps: ServiceDeps,
  ) {
    this.generateCode = deps.generateCode ?? randomDigits;
  }

  private key(kind: keyof typeof KEYS, ...parts: string[]): string {
    return [KEYS[kind], ...parts].join(KEY_SEPARATOR);
  }

  private hash(phone: string, purpose: string, code: string): string {
    return createHmac('sha256', this.deps.secret)
      .update([phone, purpose, code].join(KEY_SEPARATOR))
      .digest('hex');
  }

  private wrapStore<T>(work: Promise<T>): Promise<T> {
    return work.catch((error: unknown) => {
      throw isSdkError(error)
        ? error
        : new SdkError(ERROR_CODES.STORE_FAILED, 'code store unavailable', {
            retryable: true,
            cause: error,
          });
    });
  }

  private async blockedFor(phone: string): Promise<number> {
    return this.wrapStore(this.deps.store.ttlMs(this.key('block', phone)));
  }

  private async block(phone: string, purpose: string): Promise<number> {
    const ms = this.config.limits.blockSec * MS_PER_SECOND;
    await this.wrapStore(this.deps.store.set(this.key('block', phone), '1', ms));
    await this.wrapStore(this.deps.store.delete(this.key('code', purpose, phone)));
    this.config.logger.warn('phone blocked', { phone: maskPhone(phone), purpose });
    return ms;
  }

  async request(input: RequestInput): Promise<RequestResult> {
    assertPhone(input.phone);
    assertPurpose(input.purpose);
    assertLanguage(input.language);
    const blockedMs = await this.blockedFor(input.phone);
    if (blockedMs > 0) return { outcome: 'BLOCKED', retryAfterSeconds: secondsUp(blockedMs) };
    const cooldownKey = this.key('cooldown', input.purpose, input.phone);
    const cooldownMs = this.config.resendAfterSec * MS_PER_SECOND;
    if (
      cooldownMs > 0 &&
      !(await this.wrapStore(this.deps.store.setIfAbsent(cooldownKey, '1', cooldownMs)))
    )
      return {
        outcome: 'RATE_LIMITED',
        retryAfterSeconds: secondsUp(await this.wrapStore(this.deps.store.ttlMs(cooldownKey))),
      };
    const windowMs = this.config.limits.windowSec * MS_PER_SECOND;
    const requests = await this.wrapStore(
      this.deps.store.increment(this.key('requests', input.phone), windowMs),
    );
    if (requests > this.config.limits.requests)
      return {
        outcome: 'BLOCKED',
        retryAfterSeconds: secondsUp(await this.block(input.phone, input.purpose)),
      };
    const code = this.config.fixedCode ?? this.generateCode(this.config.codeLength);
    const ttlMs = this.config.codeTtlSec * MS_PER_SECOND;
    const record: CodeRecord = {
      hash: this.hash(input.phone, input.purpose, code),
      expiresAt: this.config.now().getTime() + ttlMs,
    };
    await this.wrapStore(
      this.deps.store.set(
        this.key('code', input.purpose, input.phone),
        JSON.stringify(record),
        ttlMs,
      ),
    );
    const delivery = await this.deliver(input, code);
    return {
      outcome: 'SENT',
      otpLength: this.config.codeLength,
      resendAfterSeconds: this.config.resendAfterSec,
      expiresInSeconds: this.config.codeTtlSec,
      deliveryId: delivery.id,
    };
  }

  private async deliver(input: RequestInput, code: string): Promise<{ id: string }> {
    try {
      return await this.deps.channel.send({
        to: input.phone,
        code,
        language: input.language,
        purpose: input.purpose,
        ttlSec: this.config.codeTtlSec,
      });
    } catch (error) {
      // The code must not survive a failed delivery, and the user may retry at once.
      await this.wrapStore(this.deps.store.delete(this.key('code', input.purpose, input.phone)));
      await this.wrapStore(
        this.deps.store.delete(this.key('cooldown', input.purpose, input.phone)),
      );
      this.config.logger.error('code delivery failed', {
        channel: this.deps.channel.name,
        phone: maskPhone(input.phone),
      });
      throw isSdkError(error)
        ? error
        : new SdkError(ERROR_CODES.DELIVERY_FAILED, 'code delivery failed', {
            retryable: true,
            cause: error,
            details: { channel: this.deps.channel.name },
          });
    }
  }

  async verify(input: VerifyInput): Promise<VerifyResult> {
    assertPhone(input.phone);
    assertPurpose(input.purpose);
    assertCode(input.code, this.config.codeLength);
    const blockedMs = await this.blockedFor(input.phone);
    if (blockedMs > 0) return { outcome: 'BLOCKED', retryAfterSeconds: secondsUp(blockedMs) };
    const codeKey = this.key('code', input.purpose, input.phone);
    const raw = await this.wrapStore(this.deps.store.get(codeKey));
    if (raw === null) return { outcome: 'EXPIRED' };
    const record = JSON.parse(raw) as CodeRecord;
    const expected = Buffer.from(record.hash, 'hex');
    const actual = Buffer.from(this.hash(input.phone, input.purpose, input.code), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      return this.wrongCode(input.phone, input.purpose);
    // Only the first concurrent caller with the right code wins.
    if (!(await this.wrapStore(this.deps.store.delete(codeKey)))) return { outcome: 'EXPIRED' };
    await this.resetLimits(input.phone);
    return this.issueToken(input.phone, input.purpose);
  }

  private async wrongCode(phone: string, purpose: string): Promise<VerifyResult> {
    const windowMs = this.config.limits.blockSec * MS_PER_SECOND;
    const wrong = await this.wrapStore(
      this.deps.store.increment(this.key('wrong', phone), windowMs),
    );
    const remaining = this.config.limits.wrongCodes - wrong;
    if (remaining > 0) return { outcome: 'WRONG_CODE', attemptsRemaining: remaining };
    return { outcome: 'BLOCKED', retryAfterSeconds: secondsUp(await this.block(phone, purpose)) };
  }

  private async issueToken(phone: string, purpose: string): Promise<VerifyResult> {
    const otpToken = randomBytes(TOKEN_BYTES).toString('hex');
    const record: TokenRecord = { phone, purpose };
    await this.wrapStore(
      this.deps.store.set(
        this.key('token', otpToken),
        JSON.stringify(record),
        this.config.tokenTtlSec * MS_PER_SECOND,
      ),
    );
    return { outcome: 'VERIFIED', otpToken, expiresInSeconds: this.config.tokenTtlSec };
  }

  async consumeToken(input: ConsumeInput): Promise<ConsumeResult> {
    assertToken(input.otpToken);
    assertPhone(input.phone);
    assertPurpose(input.purpose);
    const tokenKey = this.key('token', input.otpToken);
    const raw = await this.wrapStore(this.deps.store.get(tokenKey));
    if (raw === null) return { valid: false, reason: 'UNKNOWN_TOKEN' };
    // Burn it whatever the outcome: a token presented for the wrong phone is never usable again.
    const won = await this.wrapStore(this.deps.store.delete(tokenKey));
    const record = JSON.parse(raw) as TokenRecord;
    if (record.phone !== input.phone || record.purpose !== input.purpose)
      return { valid: false, reason: 'MISMATCH' };
    return won ? { valid: true } : { valid: false, reason: 'UNKNOWN_TOKEN' };
  }

  async resetLimits(phone: string): Promise<void> {
    assertPhone(phone);
    await this.wrapStore(
      Promise.all(
        [this.key('requests', phone), this.key('wrong', phone), this.key('block', phone)].map(
          (key) => this.deps.store.delete(key),
        ),
      ),
    );
  }

  getConfig(): { readonly otpLength: number; readonly resendAfterSeconds: number } {
    return { otpLength: this.config.codeLength, resendAfterSeconds: this.config.resendAfterSec };
  }

  async close(): Promise<void> {
    await this.deps.store.close?.();
  }
}
