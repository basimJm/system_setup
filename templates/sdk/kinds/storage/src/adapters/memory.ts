import { MS_PER_SECOND } from '../constants/defaults';
import {
  HEADERS,
  UPLOAD_METHOD,
  type RejectionReason,
  type Visibility,
} from '../constants/storage';
import type { ResolvedConfig } from '../config/options';
import type {
  ConfirmUploadRequest,
  ConfirmUploadResult,
  SignedUrlRequest,
  StorageProvider,
  UploadTarget,
  UploadUrlRequest,
  WriteObjectRequest,
} from '../types';
import {
  assertConfirmRequest,
  assertKey,
  assertSignedRequest,
  assertUploadRequest,
  assertWriteRequest,
  encodeKey,
  run,
} from '../validation';

const UPLOAD_PATH = '__upload';
const PRIVATE_PATH = 'private';

interface Pending {
  readonly visibility: Visibility;
  readonly contentType: string;
  readonly expiresAt: number;
}
interface Stored {
  readonly visibility: Visibility;
  readonly contentType: string;
  readonly body: Buffer;
}

/** Shared by every adapter: why a stored object is refused, or `undefined` when it is fine. */
export const judgeUpload = (
  size: number,
  storedType: string,
  claimedType: string,
  maxBytes: number,
): RejectionReason | undefined => {
  if (size === 0) return 'EMPTY';
  if (size > maxBytes) return 'TOO_LARGE';
  if (storedType.toLowerCase() !== claimedType.toLowerCase()) return 'TYPE_MISMATCH';
  return undefined;
};

export type MemoryConfig = Pick<
  ResolvedConfig,
  'cdnBaseUrl' | 'uploadMaxTtlSec' | 'signedUrlMaxTtlSec' | 'now'
>;

/** In-memory storage for tests and offline dev. Production config refuses it. */
export class MemoryStorage implements StorageProvider {
  private readonly pending = new Map<string, Pending>();
  private readonly objects = new Map<string, Stored>();

  constructor(protected readonly config: MemoryConfig) {}

  createUploadUrl(request: UploadUrlRequest): Promise<UploadTarget> {
    return run(() => {
      assertUploadRequest(request, this.config.uploadMaxTtlSec);
      const expiresAt = new Date(
        this.config.now().getTime() + request.expiresInSec * MS_PER_SECOND,
      );
      this.pending.set(request.key, {
        visibility: request.visibility,
        contentType: request.contentType,
        expiresAt: expiresAt.getTime(),
      });
      return {
        url: `${this.config.cdnBaseUrl}/${UPLOAD_PATH}/${encodeKey(request.key)}`,
        method: UPLOAD_METHOD,
        headers: { [HEADERS.contentType]: request.contentType },
        expiresAt,
      };
    });
  }

  confirmUpload(request: ConfirmUploadRequest): Promise<ConfirmUploadResult> {
    return run(() => {
      assertConfirmRequest(request);
      const stored = this.objects.get(request.key);
      if (stored?.visibility !== request.visibility)
        return { status: 'REJECTED', reason: 'NOT_FOUND' };
      const reason = judgeUpload(
        stored.body.length,
        stored.contentType,
        request.contentType,
        request.maxBytes,
      );
      if (reason) {
        this.objects.delete(request.key);
        return { status: 'REJECTED', reason };
      }
      return { status: 'CONFIRMED', size: stored.body.length, contentType: stored.contentType };
    });
  }

  getPublicUrl(key: string): string {
    assertKey(key);
    if (this.objects.get(key)?.visibility === 'PRIVATE') throw new RangeError('object is private');
    return `${this.config.cdnBaseUrl}/${encodeKey(key)}`;
  }

  getSignedUrl(request: SignedUrlRequest): Promise<string> {
    return run(() => {
      assertSignedRequest(request, this.config.signedUrlMaxTtlSec);
      const expires = this.config.now().getTime() + request.expiresInSec * MS_PER_SECOND;
      const path = `${PRIVATE_PATH}/${encodeKey(request.key)}`;
      return `${this.config.cdnBaseUrl}/${path}?expires=${String(expires)}&signature=memory`;
    });
  }

  read(key: string): Promise<Buffer | null> {
    return run(() => {
      assertKey(key);
      return this.objects.get(key)?.body ?? null;
    });
  }

  write(request: WriteObjectRequest): Promise<void> {
    return run(() => {
      assertWriteRequest(request);
      this.objects.set(request.key, {
        visibility: request.visibility,
        contentType: request.contentType,
        body: request.body,
      });
    });
  }

  delete(keys: readonly string[]): Promise<void> {
    return run(() => {
      keys.forEach(assertKey);
      for (const key of keys) {
        this.pending.delete(key);
        this.objects.delete(key);
      }
    });
  }

  /**
   * Test helper: the client PUTs to the presigned URL. False when no valid URL exists (403).
   * `contentType` defaults to the one the URL was created for; pass another to simulate a lie.
   */
  simulateUpload(key: string, body: Buffer, contentType?: string): boolean {
    const upload = this.pending.get(key);
    if (upload === undefined || upload.expiresAt <= this.config.now().getTime()) return false;
    this.objects.set(key, {
      visibility: upload.visibility,
      contentType: contentType ?? upload.contentType,
      body,
    });
    return true;
  }

  /** Test helper: is there a stored object under the key? */
  has(key: string): boolean {
    return this.objects.has(key);
  }

  /** Test helper: number of stored objects (leak checks). */
  get size(): number {
    return this.objects.size;
  }
}
