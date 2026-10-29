export * from './kernel';
export {
  CONSUME_REASONS,
  DEFAULTS,
  DEV_ONLY_PROVIDERS,
  ERROR_CODES,
  PROVIDERS,
  REQUEST_OUTCOMES,
  VERIFY_OUTCOMES,
  type ConsumeReason,
  type ErrorCode,
  type ProviderName,
  type RequestOutcome,
  type VerifyOutcome,
} from './constants/otp';
export { resolveConfig, type OtpOptions, type ResolvedConfig } from './config/options';
export { createOtp, type Otp } from './otp';
export { OtpService, randomDigits, type ServiceDeps } from './service';
export { MemoryCodeStore } from './adapters/memory-store';
export { FakeOtpChannel } from './adapters/fake-channel';
export { isE164, maskPhone } from './validation';
export type {
  CodeStore,
  ConsumeInput,
  ConsumeResult,
  OtpChannel,
  OtpMessage,
  OtpProvider,
  RequestInput,
  RequestResult,
  VerifyInput,
  VerifyResult,
} from './types';
