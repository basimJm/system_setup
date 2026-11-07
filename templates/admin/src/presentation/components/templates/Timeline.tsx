import type { ToneName } from '@/design/tokens/colors';
import { formatInstant } from '@/domain/shared/format';
import { useLanguage } from '../../hooks/useLanguage';
import { cx } from '../../utils/cx';

export interface TimelineEntry {
  id: string;
  title: string;
  /** Who did it ("Customer", "Vendor: Layla", "System", an admin name). */
  actor?: string;
  /** ISO instant (UTC). */
  at: string;
  /** Why (status changes always carry a reason, BUSINESS_DOMAIN §5). */
  reason?: string;
  tone?: ToneName;
}

export interface TimelineProps {
  entries: readonly TimelineEntry[];
  ariaLabel: string;
  /** Text when there is nothing yet. */
  empty: string;
}

/** Status history: one row per change, in the order given, times in Etc/GMT-3 with language digits. */
export function Timeline({ entries, ariaLabel, empty }: TimelineProps) {
  const { language } = useLanguage();
  if (entries.length === 0) return <p className="app-timeline__empty">{empty}</p>;
  return (
    <ol className="app-timeline" aria-label={ariaLabel}>
      {entries.map((entry) => (
        <li key={entry.id} className="app-timeline__item">
          <span
            className={cx('app-timeline__dot', `app-timeline__dot--${entry.tone ?? 'grey'}`)}
            aria-hidden="true"
          />
          <div className="app-timeline__body">
            <p className="app-timeline__title">{entry.title}</p>
            <p className="app-timeline__meta">
              {entry.actor ? `${entry.actor} · ` : ''}
              <time dateTime={entry.at}>{formatInstant(entry.at, language)}</time>
            </p>
            {entry.reason ? <p className="app-timeline__reason">{entry.reason}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
