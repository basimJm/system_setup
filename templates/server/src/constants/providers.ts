/** External-provider constants: how providers are selected and their static rules. */
export const PROVIDER_MODES = ['fake', 'real'] as const;
export type ProviderMode = (typeof PROVIDER_MODES)[number];
/** Used when the variable is absent outside production; production must say `real` explicitly. */
export const DEFAULT_PROVIDER_MODE: ProviderMode = 'fake';
export const REAL_PROVIDER_MODE: ProviderMode = 'real';

/** Payments may be switched off: `disabled` answers 503 on every gateway call. */
export const PAYMENT_PROVIDER_MODES = ['fake', 'real', 'disabled'] as const;
export type PaymentProviderMode = (typeof PAYMENT_PROVIDER_MODES)[number];
export const DISABLED_PAYMENT_MODE: PaymentProviderMode = 'disabled';
export const DEFAULT_PAYMENT_PROVIDER_MODE: PaymentProviderMode = 'fake';
export const PAYMENTS_DISABLED_MESSAGE = 'payments are disabled: no payment gateway is configured';

/** Why a phone is verified. Features add their own purposes here. */
export const OTP_PURPOSES = ['LOGIN', 'REGISTER', 'CHANGE_PHONE'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

/** Phone numbers cross the provider boundary in E.164 (`+9627…`). */
export const E164_PATTERN = /^\+[1-9][0-9]{6,14}$/;

/** Outcomes of checking an `otpToken`; provider failures are thrown, not returned. */
export const OTP_OUTCOMES = [
  'VERIFIED',
  'INVALID_PROOF',
  'PHONE_MISMATCH',
  'PURPOSE_MISMATCH',
  'EXPIRED',
] as const;
export type OtpOutcome = (typeof OTP_OUTCOMES)[number];

/** Outcomes of checking a typed code; a wrong code is `INVALID_CODE`, no/expired/used code `EXPIRED`. */
export const OTP_CODE_OUTCOMES = ['VERIFIED', 'INVALID_CODE', 'EXPIRED'] as const;
export type OtpCodeOutcome = (typeof OTP_CODE_OUTCOMES)[number];

export const STORAGE_VISIBILITIES = ['PUBLIC', 'PRIVATE'] as const;
export type StorageVisibility = (typeof STORAGE_VISIBILITIES)[number];

/** Object keys are server-generated paths: `a/b/file.ext`, no empty, `.` or `..` segments. */
export const OBJECT_KEY_PATTERN = /^[A-Za-z0-9_-][A-Za-z0-9._-]*(\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/;
export const OBJECT_KEY_MAX_LENGTH = 1_024;
export const CONTENT_TYPE_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;
/** Longest validity of a presigned URL (S3 SigV4 limit: 7 days). */
export const MAX_PRESIGN_TTL_SEC = 604_800;
export const UPLOAD_METHOD = 'PUT';
export const CONTENT_TYPE_HEADER = 'Content-Type';

export const STORAGE_REJECTION_REASONS = ['NOT_FOUND', 'TYPE_MISMATCH', 'TOO_LARGE'] as const;
export type StorageRejectionReason = (typeof STORAGE_REJECTION_REASONS)[number];

/** `.invalid` is a reserved TLD: fake URLs can never reach a real host. */
export const FAKE_STORAGE_UPLOAD_BASE_URL = 'https://fake-storage.invalid/upload';
export const FAKE_STORAGE_CDN_BASE_URL = 'https://fake-cdn.invalid';
export const FAKE_STORAGE_SIGNED_PATH = 'private';
export const FAKE_STORAGE_SIGNATURE = 'fake-signature';

/** Push and email delivery. */
export const PUSH_APPS = ['CUSTOMER', 'MERCHANT'] as const;
export type PushApp = (typeof PUSH_APPS)[number];
export const PUSH_KINDS = ['VISIBLE', 'DATA_ONLY'] as const;
export type PushKind = (typeof PUSH_KINDS)[number];
export const PUSH_PRIORITIES = ['NORMAL', 'HIGH'] as const;
export type PushPriority = (typeof PUSH_PRIORITIES)[number];
export const PUSH_INTERRUPTION_LEVELS = ['TIME_SENSITIVE'] as const;
export type PushInterruptionLevel = (typeof PUSH_INTERRUPTION_LEVELS)[number];
export const PUSH_TOKEN_RESULTS = ['SENT', 'INVALID_TOKEN', 'FAILED'] as const;
export type PushTokenResult = (typeof PUSH_TOKEN_RESULTS)[number];
/** FCM accepts at most 500 tokens in one multicast call. */
export const PUSH_MAX_TOKENS_PER_REQUEST = 500;
export const PUSH_TOPIC_PATTERN = /^[A-Za-z0-9_.~%-]{1,900}$/;
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9:_.-]{8,128}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMAIL_MAX_RECIPIENTS = 50;

/** Payments. Amounts are integer minor units (fils, cents...) of the platform currency. */
export const PAYMENT_STATUSES = ['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const REFUND_STATUSES = ['REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];
export const FAKE_PAYMENT_SCENARIOS = ['success', 'fail', 'cancel', 'pending'] as const;
export type FakePaymentScenario = (typeof FAKE_PAYMENT_SCENARIOS)[number];
export const PAYMENT_REFERENCE_PATTERN = /^[A-Za-z0-9_.:-]{1,64}$/;
/** The fake gateway's webhook signature: anything else is rejected as unverifiable. */
export const FAKE_WEBHOOK_SIGNATURE = 'fake-webhook-signature';
export const FAKE_GATEWAY_CODES = {
  success: '000.100.110',
  pending: '000.200.000',
  fail: '800.100.151',
  cancel: '100.396.101',
  refundFail: '800.900.300',
} as const;
/** Route of the gateway callbacks (outside the client namespaces). */
export const WEBHOOK_PREFIX = '/webhooks';
export const PAYMENT_WEBHOOK_ROUTE = '/payments';
export const WEBHOOK_SIGNATURE_HEADER = 'x-signature';

/** Server analytics. */
export const ANALYTICS_GROUPINGS = ['NAME', 'DAY'] as const;
export type AnalyticsGrouping = (typeof ANALYTICS_GROUPINGS)[number];
export const INSTALLATION_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;
/** Server event written when a guest installation is linked to an account. */
export const IDENTITY_LINKED_EVENT = 'identity.linked';
