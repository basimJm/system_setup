import type { CodeStore } from '../types';

interface Entry {
  value: string;
  expiresAt: number;
}

/** Process-local store with TTLs for dev and tests; production refuses it (`scope: 'local'`). */
export class MemoryCodeStore implements CodeStore {
  readonly scope: 'local' | 'shared' = 'local';
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  private live(key: string): Entry | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    if (entry.expiresAt <= this.now().getTime()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  set(key: string, value: string, ttlMs: number): Promise<void> {
    this.entries.set(key, { value, expiresAt: this.now().getTime() + ttlMs });
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
    this.entries.set(key, { value, expiresAt: this.now().getTime() + ttlMs });
    return Promise.resolve(true);
  }

  increment(key: string, ttlMs: number): Promise<number> {
    const entry = this.live(key);
    const count = (entry === undefined ? 0 : Number(entry.value)) + 1;
    if (entry === undefined)
      this.entries.set(key, { value: String(count), expiresAt: this.now().getTime() + ttlMs });
    else entry.value = String(count);
    return Promise.resolve(count);
  }

  ttlMs(key: string): Promise<number> {
    const entry = this.live(key);
    return Promise.resolve(entry === undefined ? 0 : entry.expiresAt - this.now().getTime());
  }

  /** Test helper: drops expired entries and returns how many live ones remain. */
  prune(): number {
    for (const key of [...this.entries.keys()]) this.live(key);
    return this.entries.size;
  }

  get size(): number {
    return this.entries.size;
  }
}
