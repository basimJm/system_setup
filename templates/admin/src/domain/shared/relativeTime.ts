import type { Language } from '../../constants/i18n';
import { INTL_LOCALES, MS_PER_DAY, MS_PER_MINUTE } from '../../constants/kernel';
import { parseInstant } from './time';

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

/**
 * "4 minutes ago" / "قبل ٤ دقائق" (design bell rows): minutes under an hour, hours under a day, then days.
 * A future instant (clock skew) reads as "now".
 */
export function formatRelative(input: string | Date, now: Date, language: Language): string {
  const instant = typeof input === 'string' ? parseInstant(input) : input;
  const elapsed = Math.max(0, now.getTime() - instant.getTime());
  const format = new Intl.RelativeTimeFormat(INTL_LOCALES[language], { numeric: 'auto' });
  const minutes = Math.floor(elapsed / MS_PER_MINUTE);
  if (minutes < MINUTES_PER_HOUR) return format.format(-minutes, 'minute');
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) return format.format(-hours, 'hour');
  return format.format(-Math.floor(elapsed / MS_PER_DAY), 'day');
}
