import type { ConfirmUploadResult, StorageProvider, UploadTarget } from '../types';
import { MemoryStorage } from './memory';

export type StorageCall = keyof StorageProvider;

/**
 * The memory adapter plus what consumers' tests need: a call log and failure injection
 * (`failWith` rejects the next calls with the given error). Refused in production.
 */
export class FakeStorage extends MemoryStorage {
  readonly calls: StorageCall[] = [];
  /** Set to make the following async calls fail with this error until cleared. */
  failWith: Error | undefined;

  private guard<T>(call: StorageCall, work: () => Promise<T>): Promise<T> {
    this.calls.push(call);
    return this.failWith === undefined ? work() : Promise.reject(this.failWith);
  }

  override createUploadUrl(
    ...args: Parameters<StorageProvider['createUploadUrl']>
  ): Promise<UploadTarget> {
    return this.guard('createUploadUrl', () => super.createUploadUrl(...args));
  }

  override confirmUpload(
    ...args: Parameters<StorageProvider['confirmUpload']>
  ): Promise<ConfirmUploadResult> {
    return this.guard('confirmUpload', () => super.confirmUpload(...args));
  }

  override getPublicUrl(key: string): string {
    this.calls.push('getPublicUrl');
    return super.getPublicUrl(key);
  }

  override getSignedUrl(...args: Parameters<StorageProvider['getSignedUrl']>): Promise<string> {
    return this.guard('getSignedUrl', () => super.getSignedUrl(...args));
  }

  override read(key: string): Promise<Buffer | null> {
    return this.guard('read', () => super.read(key));
  }

  override write(...args: Parameters<StorageProvider['write']>): Promise<void> {
    return this.guard('write', () => super.write(...args));
  }

  override delete(keys: readonly string[]): Promise<void> {
    return this.guard('delete', () => super.delete(keys));
  }
}
