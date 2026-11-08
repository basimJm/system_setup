import { BUSINESS_TIME_ZONE } from '@/constants/kernel';

/** Milliseconds the business zone is ahead of UTC at `ms`, read from Intl (not from the code under test). */
const offsetAt = (ms: number): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(ms));
  const part = (type: string): number => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return wall - Math.floor(ms / 1000) * 1000;
};

/**
 * The UTC instant at which the clock of the business zone reads `date` (`YYYY-MM-DD`) `hour`:`minute`.
 * Tests build their instants with it, so they hold for any configured zone.
 */
export const localInstant = (date: string, hour = 0, minute = 0): Date => {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  return new Date(wall - offsetAt(wall - offsetAt(wall)));
};
