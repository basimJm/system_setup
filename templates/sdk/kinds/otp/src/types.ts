import type { ConsumeReason, RequestOutcome, VerifyOutcome } from './constants/otp';

/**
 * Key/value store with TTL for code hashes, counters, blocks and tokens. `local` stores live in
 * one process and are refused in production; a `shared` one (Redis) must be atomic per call.
 */
export interface CodeStore {
  readonly scope: 'local' | 'shared';
  set(key: string, value: string, ttlMs: number): Promise<void>;
  get(key: string): Promise<string | null>;
  /** True when the key existed: exactly one concurrent caller wins. */
  delete(key: string): Promise<boolean>;
  /** Sets only when absent; true when this call set it. */
  setIfAbsent(key: string, value: string, ttlMs: number): Promise<boolean>;
  /** Atomic counter; the TTL starts with the first increment. */
  increment(key: string, ttlMs: number): Promise<number>;
  /** Remaining life in ms, 0 when absent or expired. */
  ttlMs(key: string): Promise<number>;
  close?(): Promise<void>;
}

export interface OtpMessage {
  /** E.164 recipient. */
  readonly to: string;
  /** Never log it. */
  readonly code: string;
  readonly language: string;
  readonly purpose: string;
  readonly ttlSec: number;
}

/** A way to deliver a code (WhatsApp, SMS, email…). Failures throw; the service maps them. */
export interface OtpChannel {
  readonly name: string;
  /** Production refuses a channel that says so. */
  readonly isFake?: boolean;
  send(message: OtpMessage): Promise<{ readonly id: string }>;
}

export interface RequestInput {
  readonly phone: string;
  readonly purpose: string;
  readonly language: string;
}

export type RequestResult =
  | {
      readonly outcome: Extract<RequestOutcome, 'SENT'>;
      readonly otpLength: number;
      readonly resendAfterSeconds: number;
      readonly expiresInSeconds: number;
      readonly deliveryId: string;
    }
  | {
      readonly outcome: Exclude<RequestOutcome, 'SENT'>;
      readonly retryAfterSeconds: number;
    };

export interface VerifyInput {
  readonly phone: string;
  readonly purpose: string;
  readonly code: string;
}

export type VerifyResult =
  | {
      readonly outcome: Extract<VerifyOutcome, 'VERIFIED'>;
      /** Single-use proof the consumer's login/register/sensitive action takes. */
      readonly otpToken: string;
      readonly expiresInSeconds: number;
    }
  | { readonly outcome: Extract<VerifyOutcome, 'WRONG_CODE'>; readonly attemptsRemaining: number }
  | { readonly outcome: Extract<VerifyOutcome, 'EXPIRED'> }
  | { readonly outcome: Extract<VerifyOutcome, 'BLOCKED'>; readonly retryAfterSeconds: number };

export interface ConsumeInput {
  readonly otpToken: string;
  readonly phone: string;
  readonly purpose: string;
}

export type ConsumeResult =
  { readonly valid: true } | { readonly valid: false; readonly reason: ConsumeReason };

/** The port: request a code, verify it, spend the resulting token once. */
export interface OtpProvider {
  request(input: RequestInput): Promise<RequestResult>;
  verify(input: VerifyInput): Promise<VerifyResult>;
  consumeToken(input: ConsumeInput): Promise<ConsumeResult>;
  /** Clears counters, block and cooldown of a phone (admin unblock). */
  resetLimits(phone: string): Promise<void>;
  getConfig(): { readonly otpLength: number; readonly resendAfterSeconds: number };
  close(): Promise<void>;
}
