import { MS_PER_SECOND } from '../../constants/defaults';
import {
  DELETE_CONCURRENCY,
  ERROR_CODES,
  HEADERS,
  HTTP_STATUS,
  S3,
  UPLOAD_METHOD,
  type Visibility,
} from '../../constants/storage';
import type { FetchLike, ResolvedConfig, S3Config } from '../../config/options';
import { SdkError, toSdkError } from '../../errors';
import { realRetryDeps, withRetry, withTimeout, type RetryDeps } from '../../retry';
import type {
  ConfirmUploadRequest,
  ConfirmUploadResult,
  SignedUrlRequest,
  StorageProvider,
  UploadTarget,
  UploadUrlRequest,
  WriteObjectRequest,
} from '../../types';
import {
  assertConfirmRequest,
  assertKey,
  assertSignedRequest,
  assertUploadRequest,
  assertWriteRequest,
  encodeKey,
  run,
} from '../../validation';
import { judgeUpload } from '../memory';
import { presignUrl, signHeaders, type SigV4Scope } from './sigv4';

const METHODS = { head: 'HEAD', get: 'GET', put: 'PUT', delete: 'DELETE' } as const;

/** Every HTTP status the store can answer, mapped (Rules.md §3.8). `null` = not found. */
export const mapStatus = (status: number): SdkError | 'ok' | 'notFound' => {
  if (status === HTTP_STATUS.ok || status === HTTP_STATUS.noContent) return 'ok';
  if (status === HTTP_STATUS.notFound) return 'notFound';
  const fail = (code: string, message: string, retryable = false): SdkError =>
    new SdkError(code, message, { retryable, details: { status } });
  if (status === HTTP_STATUS.forbidden) return fail(ERROR_CODES.AUTH_FAILED, 'access denied');
  if (status === HTTP_STATUS.tooManyRequests || status === HTTP_STATUS.serviceUnavailable)
    return fail(ERROR_CODES.RATE_LIMITED, 'store is throttling', true);
  if (status >= HTTP_STATUS.serverErrorMin)
    return fail(ERROR_CODES.UNAVAILABLE, 'store is unavailable', true);
  if (status === HTTP_STATUS.badRequest) return fail(ERROR_CODES.VENDOR_ERROR, 'store rejected it');
  return fail(ERROR_CODES.UNKNOWN, `unexpected store status ${String(status)}`);
};

export interface S3Deps {
  readonly fetch: FetchLike;
  readonly retryDeps?: RetryDeps;
}

type S3Resolved = ResolvedConfig & { readonly s3: S3Config };

/**
 * S3-compatible object store signed with SigV4 (`node:crypto` only, no vendor SDK). Works with
 * AWS S3, MinIO (dev, `endpoint` + path style), Spaces, R2. Every HTTP status is mapped.
 */
export class S3Storage implements StorageProvider {
  private readonly scope: SigV4Scope;
  private readonly retryDeps: RetryDeps;

  constructor(
    private readonly config: S3Resolved,
    private readonly deps: S3Deps,
  ) {
    this.scope = { region: config.s3.region, credentials: config.s3.credentials, now: config.now };
    this.retryDeps = deps.retryDeps ?? realRetryDeps;
  }

  objectUrl(visibility: Visibility, key: string): URL {
    const bucket =
      visibility === 'PUBLIC' ? this.config.s3.publicBucket : this.config.s3.privateBucket;
    const path = encodeKey(key);
    if (this.config.s3.endpoint !== undefined && this.config.s3.forcePathStyle)
      return new URL(`${this.config.s3.endpoint.replace(/\/+$/, '')}/${bucket}/${path}`);
    const origin =
      this.config.s3.endpoint === undefined
        ? `https://${S3.awsHost(bucket, this.config.s3.region)}`
        : this.config.s3.endpoint.replace(/\/\/([^/]+)/, `//${bucket}.$1`).replace(/\/+$/, '');
    return new URL(`${origin}/${path}`);
  }

  createUploadUrl(request: UploadUrlRequest): Promise<UploadTarget> {
    return run(() => {
      assertUploadRequest(request, this.config.uploadMaxTtlSec);
      const url = presignUrl(this.scope, {
        method: UPLOAD_METHOD,
        url: this.objectUrl(request.visibility, request.key),
        expiresInSec: request.expiresInSec,
      });
      const expiresAt = new Date(
        this.config.now().getTime() + request.expiresInSec * MS_PER_SECOND,
      );
      return {
        url,
        method: UPLOAD_METHOD,
        headers: { [HEADERS.contentType]: request.contentType },
        expiresAt,
      };
    });
  }

  async confirmUpload(request: ConfirmUploadRequest): Promise<ConfirmUploadResult> {
    assertConfirmRequest(request);
    const url = this.objectUrl(request.visibility, request.key);
    const response = await this.send(METHODS.head, url);
    if (response === null) return { status: 'REJECTED', reason: 'NOT_FOUND' };
    const size = Number(response.headers.get(HEADERS.contentLength) ?? Number.NaN);
    const storedType = response.headers.get(HEADERS.contentType) ?? '';
    if (!Number.isFinite(size))
      throw new SdkError(ERROR_CODES.MALFORMED_RESPONSE, 'HEAD without content-length');
    const reason = judgeUpload(size, storedType, request.contentType, request.maxBytes);
    if (reason) {
      await this.send(METHODS.delete, url);
      return { status: 'REJECTED', reason };
    }
    return { status: 'CONFIRMED', size, contentType: storedType };
  }

  getPublicUrl(key: string): string {
    assertKey(key);
    return `${this.config.cdnBaseUrl}/${encodeKey(key)}`;
  }

  getSignedUrl(request: SignedUrlRequest): Promise<string> {
    return run(() => {
      assertSignedRequest(request, this.config.signedUrlMaxTtlSec);
      return presignUrl(this.scope, {
        method: METHODS.get,
        url: this.objectUrl('PRIVATE', request.key),
        expiresInSec: request.expiresInSec,
      });
    });
  }

  /** Reads the public location first, then the private one. */
  async read(key: string): Promise<Buffer | null> {
    assertKey(key);
    for (const visibility of ['PUBLIC', 'PRIVATE'] as const) {
      const response = await this.send(METHODS.get, this.objectUrl(visibility, key));
      if (response === null) continue;
      const size = Number(response.headers.get(HEADERS.contentLength) ?? 0);
      if (size > this.config.readMaxBytes)
        throw new SdkError(ERROR_CODES.TOO_LARGE, 'object exceeds readMaxBytes', {
          details: { size },
        });
      return Buffer.from(await response.arrayBuffer());
    }
    return null;
  }

  async write(request: WriteObjectRequest): Promise<void> {
    assertWriteRequest(request);
    await this.send(
      METHODS.put,
      this.objectUrl(request.visibility, request.key),
      { [HEADERS.contentType]: request.contentType },
      request.body,
    );
  }

  /** Deletes from both locations; missing keys are fine (404 is success for a delete). */
  async delete(keys: readonly string[]): Promise<void> {
    keys.forEach(assertKey);
    const targets = keys.flatMap((key) =>
      (['PUBLIC', 'PRIVATE'] as const).map((visibility) => this.objectUrl(visibility, key)),
    );
    for (let start = 0; start < targets.length; start += DELETE_CONCURRENCY)
      await Promise.all(
        targets
          .slice(start, start + DELETE_CONCURRENCY)
          .map((url) => this.send(METHODS.delete, url)),
      );
  }

  /** One signed request with timeout + retry; `null` on 404, `SdkError` on every other failure. */
  private send(
    method: string,
    url: URL,
    headers: Record<string, string> = {},
    body?: Uint8Array,
  ): Promise<Awaited<ReturnType<FetchLike>> | null> {
    return withRetry(
      async () => {
        const signed = signHeaders(this.scope, { method, url, headers, body });
        const init = { method, headers: signed, ...(body ? { body } : {}) };
        const response = await withTimeout(
          this.deps.fetch(url.toString(), init).catch((error: unknown) => {
            throw new SdkError(ERROR_CODES.NETWORK_ERROR, 'store unreachable', {
              retryable: true,
              cause: error,
            });
          }),
          this.config.timeoutMs,
        ).catch((error: unknown) => {
          throw toSdkError(error);
        });
        const outcome = mapStatus(response.status);
        if (outcome === 'ok') return response;
        if (outcome === 'notFound') return null;
        this.config.logger.warn('store request failed', { method, status: response.status });
        throw outcome;
      },
      this.config.retry,
      this.retryDeps,
    );
  }
}
