import type { StorageRejectionReason, StorageVisibility } from '../../constants/providers';

export interface UploadUrlRequest {
  /** Server-generated object key; clients never choose it. */
  readonly key: string;
  readonly visibility: StorageVisibility;
  readonly contentType: string;
  readonly maxBytes: number;
  readonly expiresInSec: number;
}

export interface UploadTarget {
  readonly url: string;
  readonly method: 'PUT';
  /** Headers the client must send with the upload. */
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresAt: Date;
}

export interface WriteObjectRequest {
  readonly key: string;
  readonly body: Buffer;
  readonly contentType: string;
  readonly visibility: StorageVisibility;
}

export interface ConfirmUploadRequest {
  readonly key: string;
  readonly visibility: StorageVisibility;
  readonly contentType: string;
  readonly maxBytes: number;
}

/** A rejected object has already been deleted by the provider. */
export type ConfirmUploadResult =
  | { readonly status: 'CONFIRMED'; readonly size: number; readonly contentType: string }
  | { readonly status: 'REJECTED'; readonly reason: StorageRejectionReason };

export interface SignedUrlRequest {
  readonly key: string;
  readonly expiresInSec: number;
}

/**
 * File storage behind one interface: presigned direct uploads, upload
 * confirmation by the real content, CDN URLs for public objects and short-lived signed URLs for
 * private ones. Policies (which purpose may upload what) belong to the uploads module, not here.
 * Provider failures throw `ExternalServiceError`.
 */
export interface StorageProvider {
  createUploadUrl(request: UploadUrlRequest): Promise<UploadTarget>;
  confirmUpload(request: ConfirmUploadRequest): Promise<ConfirmUploadResult>;
  /** CDN URL of a public object. Pure: no network call. */
  getPublicUrl(key: string): string;
  /** Short-lived URL to read a private object. */
  getSignedUrl(request: SignedUrlRequest): Promise<string>;
  /** Bytes of a stored object (for server-side processing); `null` when it does not exist. */
  read(key: string): Promise<Buffer | null>;
  /** Stores an object written by the server itself (e.g. an image variant). */
  write(request: WriteObjectRequest): Promise<void>;
  /** Deletes the objects; keys that do not exist are ignored. */
  delete(keys: readonly string[]): Promise<void>;
}
