/**
 * Remembers the result of an operation per idempotency key (push and payments:
 * one key per attempt): the same key with the same request returns the first result and does not
 * run again; the same key with a different request is a caller bug.
 */
export class IdempotencyStore<T> {
  private readonly entries = new Map<string, { fingerprint: string; result: T }>();

  async run(key: string, fingerprint: string, operation: () => Promise<T>): Promise<T> {
    const known = this.entries.get(key);
    if (known !== undefined) {
      if (known.fingerprint !== fingerprint) {
        throw new RangeError('idempotency key reused with different parameters');
      }
      return known.result;
    }
    const result = await operation();
    this.entries.set(key, { fingerprint, result });
    return result;
  }
}
