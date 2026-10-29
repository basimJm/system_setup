import { KERNEL_ERROR_CODES } from './codes';

export const ERROR_CODES = {
  ...KERNEL_ERROR_CODES,
  KEY_INVALID: '__SDK_PREFIX___KEY_INVALID',
  ACCESS_DENIED: '__SDK_PREFIX___ACCESS_DENIED',
  TOO_LARGE: '__SDK_PREFIX___TOO_LARGE',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const VISIBILITIES = ['PUBLIC', 'PRIVATE'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const PROVIDERS = ['fake', 'memory', 's3'] as const;
export type ProviderName = (typeof PROVIDERS)[number];
export const DEV_ONLY_PROVIDERS: readonly ProviderName[] = ['fake', 'memory'];

/** Why an uploaded object was refused (and deleted) by `confirmUpload`. */
export const REJECTION_REASONS = ['NOT_FOUND', 'EMPTY', 'TYPE_MISMATCH', 'TOO_LARGE'] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export const UPLOAD_METHOD = 'PUT';
export const HEADERS = {
  contentType: 'Content-Type',
  contentLength: 'content-length',
  host: 'host',
  amzDate: 'x-amz-date',
  amzContentSha256: 'x-amz-content-sha256',
  amzSecurityToken: 'x-amz-security-token',
  authorization: 'Authorization',
} as const;

/** Object keys are server-generated paths: `a/b/file.ext`, no empty, `.` or `..` segments. */
export const OBJECT_KEY_PATTERN = /^[A-Za-z0-9_-][A-Za-z0-9._-]*(\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/;
export const OBJECT_KEY_MAX_LENGTH = 1_024;
export const CONTENT_TYPE_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;
/** Longest validity of a presigned URL (SigV4 limit: 7 days). */
export const MAX_PRESIGN_TTL_SEC = 604_800;
export const DEFAULT_UPLOAD_MAX_TTL_SEC = 300;
export const DEFAULT_SIGNED_URL_MAX_TTL_SEC = 600;
/** Largest object `read` returns; bigger objects are refused instead of exhausting memory. */
export const DEFAULT_READ_MAX_BYTES = 50 * 1024 * 1024;
/** Objects deleted in parallel per batch. */
export const DELETE_CONCURRENCY = 20;

export const S3 = {
  service: 's3',
  algorithm: 'AWS4-HMAC-SHA256',
  requestScope: 'aws4_request',
  unsignedPayload: 'UNSIGNED-PAYLOAD',
  emptyPayloadSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  /** Virtual-host endpoint of AWS itself; S3-compatible stores set `s3.endpoint` instead. */
  awsHost: (bucket: string, region: string): string => `${bucket}.s3.${region}.amazonaws.com`,
  query: {
    algorithm: 'X-Amz-Algorithm',
    credential: 'X-Amz-Credential',
    date: 'X-Amz-Date',
    expires: 'X-Amz-Expires',
    signedHeaders: 'X-Amz-SignedHeaders',
    signature: 'X-Amz-Signature',
    securityToken: 'X-Amz-Security-Token',
  },
} as const;

export const HTTP_STATUS = {
  ok: 200,
  noContent: 204,
  badRequest: 400,
  forbidden: 403,
  notFound: 404,
  tooManyRequests: 429,
  serviceUnavailable: 503,
  serverErrorMin: 500,
} as const;
