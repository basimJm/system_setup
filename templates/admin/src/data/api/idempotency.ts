/** A fresh key for one logical command; retries of the same command must reuse it. */
export const newIdempotencyKey = (): string => crypto.randomUUID();
