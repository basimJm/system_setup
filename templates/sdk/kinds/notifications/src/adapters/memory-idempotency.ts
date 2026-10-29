import type { IdempotencyStore } from '../types';

/** Process-local idempotency keys with TTL; production refuses it (`scope: 'local'`). */
export class MemoryIdempotencyStore implements IdempotencyStore {
  readonly scope: 'local' | 'shared' = 'local';
  private readonly keys = new Map<string, number>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  claim(key: string, ttlMs: number): Promise<boolean> {
    const current = this.now().getTime();
    const expiresAt = this.keys.get(key);
    if (expiresAt !== undefined && expiresAt > current) return Promise.resolve(false);
    this.keys.set(key, current + ttlMs);
    return Promise.resolve(true);
  }

  /** Test helper: drops expired keys and returns how many live ones remain. */
  prune(): number {
    const current = this.now().getTime();
    for (const [key, expiresAt] of this.keys) if (expiresAt <= current) this.keys.delete(key);
    return this.keys.size;
  }
}
