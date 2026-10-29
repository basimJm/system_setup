/** The shared kernel: identical in every `__SYSTEM_SLUG__-*` SDK. Kinds re-export it from `index.ts`. */
export {
  ENVIRONMENTS,
  KERNEL_ERROR_CODES,
  type Environment,
  type KernelErrorCode,
} from './constants/codes';
export {
  DEFAULT_RETRY,
  DEFAULT_TIMEOUT_MS,
  FAKE_PROVIDER,
  MEMORY_PROVIDER,
  SDK_NAME,
} from './constants/defaults';
export {
  SdkError,
  configError,
  isSdkError,
  toSdkError,
  validationError,
  type SdkErrorOptions,
} from './errors';
export { noopLogger, redact, redactingLogger, type LogFields, type Logger } from './logger';
export {
  delayFor,
  isRetryable,
  realRetryDeps,
  timeoutError,
  withRetry,
  withTimeout,
  type RetryDeps,
  type RetryPolicy,
} from './retry';
export {
  environmentSchema,
  isHttps,
  parseOptions,
  plainOptions,
  positiveInt,
  prodIssues,
  resolveRetry,
  retrySchema,
  text,
  throwIfIssues,
  trimSlash,
  type ConfigIssue,
  type ProdCheck,
} from './config/common';
