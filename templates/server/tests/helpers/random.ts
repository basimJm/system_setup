/**
 * Seeded randomness for property-style tests: no dependency, and every run produces the same
 * data, so a failure can always be reproduced.
 */
export type Random = () => number;

/** mulberry32: small, fast, good enough for test data. Returns numbers in [0, 1). */
export const createRandom = (seed: number): Random => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
};

/** Integer in [0, max], using 53 random bits so large maxima are covered. */
export const randomUpTo = (rand: Random, max: number): number => {
  const high = Math.floor(rand() * 2 ** 21);
  const low = Math.floor(rand() * 2 ** 32);
  return (high * 2 ** 32 + low) % (max + 1);
};

/** Integer in [min, max]. */
export const randomBetween = (rand: Random, min: number, max: number): number =>
  min + randomUpTo(rand, max - min);
