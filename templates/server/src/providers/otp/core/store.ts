import type { Redis } from 'ioredis';

/** Code hashes and used-proof flags with TTL. Production needs the shared (Redis) implementation. */
export interface CodeStore {
  readonly scope: 'local' | 'shared';
  set(key: string, value: string, ttlMs: number): Promise<void>;
  get(key: string): Promise<string | null>;
  /** Returns true when the key existed, so exactly one concurrent caller wins. */
  delete(key: string): Promise<boolean>;
  /** Sets only when absent; returns true when this call set it. */
  setIfAbsent(key: string, value: string, ttlMs: number): Promise<boolean>;
}

interface Entry {
  readonly value: string;
  readonly expiresAt: number;
}

/** Process-local code store with TTL (dev and unit tests). Refused in production. */
export class MemoryCodeStore implements CodeStore {
  readonly scope = 'local';
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly now: () => number = Date.now) {}

  set(key: string, value: string, ttlMs: number): Promise<void> {
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
    return Promise.resolve();
  }

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.live(key)?.value ?? null);
  }

  delete(key: string): Promise<boolean> {
    const existed = this.live(key) !== undefined;
    this.entries.delete(key);
    return Promise.resolve(existed);
  }

  setIfAbsent(key: string, value: string, ttlMs: number): Promise<boolean> {
    if (this.live(key) !== undefined) return Promise.resolve(false);
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
    return Promise.resolve(true);
  }

  /** Number of live entries (tests check nothing is left behind). */
  size(): number {
    for (const key of [...this.entries.keys()]) this.live(key);
    return this.entries.size;
  }

  private live(key: string): Entry | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    if (entry.expiresAt > this.now()) return entry;
    this.entries.delete(key);
    return undefined;
  }
}

// KEYS[1]; ARGV: value, ttlMs. Returns 1 when this call set the key.
const SET_NX_SCRIPT = `
if redis.call('set', KEYS[1], ARGV[1], 'PX', ARGV[2], 'NX') then return 1 end
return 0`;

/** Shared `CodeStore` on the server's Redis connection (every running server, dev included). */
export class RedisCodeStore implements CodeStore {
  readonly scope = 'shared';

  constructor(private readonly redis: Redis) {}

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    // A resend replaces the previous code.
    await this.redis.set(key, value, 'PX', ttlMs);
  }

  get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async delete(key: string): Promise<boolean> {
    return (await this.redis.del(key)) > 0;
  }

  async setIfAbsent(key: string, value: string, ttlMs: number): Promise<boolean> {
    return (await this.redis.eval(SET_NX_SCRIPT, 1, key, value, ttlMs)) === 1;
  }
}
