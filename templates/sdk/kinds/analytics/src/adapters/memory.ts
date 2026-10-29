import type { AnalyticsSink, Envelope } from '../types';

const MEMORY = 'memory';
const FAKE = 'fake';

/** Keeps every delivered envelope in process (dev inspection, tests). Refused in production. */
export class MemorySink implements AnalyticsSink {
  readonly name: string = MEMORY;
  readonly isFake = true;
  readonly events: Envelope[] = [];
  readonly batches: number[] = [];

  deliver(batch: readonly Envelope[]): Promise<void> {
    this.events.push(...batch);
    this.batches.push(batch.length);
    return Promise.resolve();
  }

  /** Events with this name, in delivery order. */
  named(name: string): Envelope[] {
    return this.events.filter((event) => event.name === name);
  }

  clear(): void {
    this.events.length = 0;
    this.batches.length = 0;
  }
}

/** The memory sink plus failure injection: `failWith` rejects the next deliveries until cleared. */
export class FakeSink extends MemorySink {
  override readonly name = FAKE;
  failWith: Error | undefined;
  /** How many deliveries were refused. */
  refused = 0;

  override deliver(batch: readonly Envelope[]): Promise<void> {
    if (this.failWith !== undefined) {
      this.refused += 1;
      return Promise.reject(this.failWith);
    }
    return super.deliver(batch);
  }
}
