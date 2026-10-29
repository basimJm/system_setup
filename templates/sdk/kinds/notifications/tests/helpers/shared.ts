import { MemoryIdempotencyStore } from '../../src/adapters/memory-idempotency';

/** The memory idempotency store pretending to be shared, for production-rule tests. */
export class SharedIdempotencyStore extends MemoryIdempotencyStore {
  override readonly scope = 'shared' as const;
}
