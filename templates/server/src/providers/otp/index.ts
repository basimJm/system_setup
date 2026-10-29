export { FakeOtpProvider, type FakeOtpOptions } from './fake';
export { createRealOtp, createRealOtpChannel, type RealOtpDeps } from './real';
export { createCodeOtp, type CodeOtpOptions } from './core/codeFlow';
export { createProofs, type Proofs } from './core/proofs';
export { MemoryCodeStore, RedisCodeStore, type CodeStore } from './core/store';
export { FakeOtpChannel, OtpDeliveryError, type OtpChannel, type OtpMessage } from './core/channel';
export type {
  OtpCodeInput,
  OtpCodeResult,
  OtpCodeRules,
  OtpProvider,
  OtpSendInput,
  OtpVerifyInput,
  OtpVerifyResult,
} from './types';
