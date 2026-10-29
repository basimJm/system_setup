import {
  CONTENT_TYPE_HEADER,
  FAKE_STORAGE_CDN_BASE_URL,
  FAKE_STORAGE_SIGNATURE,
  FAKE_STORAGE_SIGNED_PATH,
  FAKE_STORAGE_UPLOAD_BASE_URL,
  UPLOAD_METHOD,
  type StorageVisibility,
} from '../../constants/providers';
import { MS_PER_SECOND } from '../../constants/time';
import type {
  ConfirmUploadRequest,
  ConfirmUploadResult,
  SignedUrlRequest,
  StorageProvider,
  UploadTarget,
  UploadUrlRequest,
  WriteObjectRequest,
} from './types';
import { assertContentType, assertObjectKey, assertPositiveInteger, assertTtl } from './validation';

interface PendingUpload {
  readonly visibility: StorageVisibility;
  readonly contentType: string;
  readonly maxBytes: number;
  readonly expiresAt: number;
}

interface StoredObject {
  readonly visibility: StorageVisibility;
  /** What the "real" content turned out to be (the fake has no bytes to sniff). */
  readonly contentType: string;
  readonly size: number;
  readonly body?: Buffer;
}

export interface FakeStorageOptions {
  readonly now?: () => Date;
  readonly uploadBaseUrl?: string;
  readonly cdnBaseUrl?: string;
}

/** Runs `work` and always answers with a promise, so caller bugs reject like a real async API. */
const settle = <T>(work: () => T): Promise<T> => {
  try {
    return Promise.resolve(work());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
};

const encodeKey = (key: string): string => key.split('/').map(encodeURIComponent).join('/');

/** In-memory stand-in for S3 + CDN (dev/test only; production config refuses it). */
export class FakeStorageProvider implements StorageProvider {
  private readonly pending = new Map<string, PendingUpload>();
  private readonly objects = new Map<string, StoredObject>();
  private readonly now: () => Date;
  private readonly uploadBaseUrl: string;
  private readonly cdnBaseUrl: string;

  constructor({
    now = () => new Date(),
    uploadBaseUrl = FAKE_STORAGE_UPLOAD_BASE_URL,
    cdnBaseUrl = FAKE_STORAGE_CDN_BASE_URL,
  }: FakeStorageOptions = {}) {
    this.now = now;
    this.uploadBaseUrl = uploadBaseUrl;
    this.cdnBaseUrl = cdnBaseUrl;
  }

  createUploadUrl(request: UploadUrlRequest): Promise<UploadTarget> {
    return settle(() => {
      assertObjectKey(request.key);
      assertContentType(request.contentType);
      assertPositiveInteger(request.maxBytes, 'maxBytes');
      assertTtl(request.expiresInSec);
      const expiresAt = new Date(this.now().getTime() + request.expiresInSec * MS_PER_SECOND);
      this.pending.set(request.key, {
        visibility: request.visibility,
        contentType: request.contentType,
        maxBytes: request.maxBytes,
        expiresAt: expiresAt.getTime(),
      });
      return {
        url: `${this.uploadBaseUrl}/${encodeKey(request.key)}`,
        method: UPLOAD_METHOD,
        headers: { [CONTENT_TYPE_HEADER]: request.contentType },
        expiresAt,
      };
    });
  }

  confirmUpload(request: ConfirmUploadRequest): Promise<ConfirmUploadResult> {
    return settle(() => {
      assertObjectKey(request.key);
      assertContentType(request.contentType);
      assertPositiveInteger(request.maxBytes, 'maxBytes');
      const stored = this.objects.get(request.key);
      if (stored === undefined || stored.visibility !== request.visibility) {
        return { status: 'REJECTED', reason: 'NOT_FOUND' };
      }
      if (stored.contentType !== request.contentType)
        return this.reject(request.key, 'TYPE_MISMATCH');
      if (stored.size > request.maxBytes) return this.reject(request.key, 'TOO_LARGE');
      return { status: 'CONFIRMED', size: stored.size, contentType: stored.contentType };
    });
  }

  getPublicUrl(key: string): string {
    assertObjectKey(key);
    const known = this.objects.get(key) ?? this.pending.get(key);
    if (known?.visibility === 'PRIVATE') throw new RangeError('object is private');
    return `${this.cdnBaseUrl}/${encodeKey(key)}`;
  }

  getSignedUrl({ key, expiresInSec }: SignedUrlRequest): Promise<string> {
    return settle(() => {
      assertObjectKey(key);
      assertTtl(expiresInSec);
      const expires = this.now().getTime() + expiresInSec * MS_PER_SECOND;
      return (
        `${this.cdnBaseUrl}/${FAKE_STORAGE_SIGNED_PATH}/${encodeKey(key)}` +
        `?expires=${String(expires)}&signature=${FAKE_STORAGE_SIGNATURE}`
      );
    });
  }

  read(key: string): Promise<Buffer | null> {
    return settle(() => {
      assertObjectKey(key);
      return this.objects.get(key)?.body ?? null;
    });
  }

  write({ key, body, contentType, visibility }: WriteObjectRequest): Promise<void> {
    return settle(() => {
      assertObjectKey(key);
      assertContentType(contentType);
      this.objects.set(key, { visibility, contentType, size: body.length, body });
    });
  }

  delete(keys: readonly string[]): Promise<void> {
    return settle(() => {
      for (const key of keys) assertObjectKey(key);
      for (const key of keys) {
        this.pending.delete(key);
        this.objects.delete(key);
      }
    });
  }

  /**
   * Test helper: the client uploads to the presigned URL. Returns false (nothing stored) when no
   * valid upload URL exists for the key, as a real bucket would answer 403.
   */
  simulateUpload(
    key: string,
    content: { contentType: string; size: number; body?: Buffer },
  ): boolean {
    const upload = this.pending.get(key);
    if (upload === undefined || upload.expiresAt <= this.now().getTime()) return false;
    this.objects.set(key, {
      visibility: upload.visibility,
      ...content,
      size: content.body?.length ?? content.size,
    });
    return true;
  }

  /** Test helper: is there a stored object under the key? */
  has(key: string): boolean {
    return this.objects.has(key);
  }

  private reject(key: string, reason: 'TYPE_MISMATCH' | 'TOO_LARGE'): ConfirmUploadResult {
    this.objects.delete(key);
    this.pending.delete(key);
    return { status: 'REJECTED', reason };
  }
}
