import { assertInstant } from './instant';

/**
 * A half-open span of time, `[start, end)`: it includes `start` and excludes `end`, so two
 * back-to-back ranges (one ends when the next starts) do not overlap.
 */
export interface TimeRange {
  readonly start: Date;
  readonly end: Date;
}

const assertRange = (range: TimeRange, name: string): void => {
  assertInstant(range.start, `${name}.start`);
  assertInstant(range.end, `${name}.end`);
  if (range.end.getTime() <= range.start.getTime()) {
    throw new RangeError(`${name} must end after it starts`);
  }
};

/** Do the two ranges share any time? Touching ends do not count. */
export const rangesOverlap = (first: TimeRange, second: TimeRange): boolean => {
  assertRange(first, 'first range');
  assertRange(second, 'second range');
  return (
    first.start.getTime() < second.end.getTime() && second.start.getTime() < first.end.getTime()
  );
};

/** Is `instant` inside the range (its start counts, its end does not)? */
export const containsInstant = (range: TimeRange, instant: Date): boolean => {
  assertRange(range, 'range');
  assertInstant(instant);
  return range.start.getTime() <= instant.getTime() && instant.getTime() < range.end.getTime();
};
