import { MemoryCodeStore } from '../../src/adapters/memory-store';

/** The memory store pretending to be shared (Redis-like), for production-rule tests. */
export class SharedStore extends MemoryCodeStore {
  override readonly scope = 'shared' as const;
}
