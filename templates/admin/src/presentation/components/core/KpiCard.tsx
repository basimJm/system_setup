import type { ReactNode } from 'react';
import { cx } from '../../utils/cx';
import { Card } from './Card';
import { Skeleton } from '../feedback/Skeleton';

export interface KpiPart {
  key: string;
  label: ReactNode;
  value: string;
}

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  /** Change vs the previous period, in percent; sign decides the color/arrow. */
  deltaPercent?: number;
  deltaLabel?: string;
  loading?: boolean;
  /** Breakdown under a dashed line (design: "visitors 56 · customers 75"). */
  parts?: readonly KpiPart[];
  /** Muted line under the value (design `sub`, or "No data yet" when the server has no number). */
  note?: string;
  /** Design `tone: 'rose'`: the value is a failure count. */
  tone?: 'rose';
}

const ARROW_UP = '↑';
const ARROW_DOWN = '↓';

export function KpiCard({
  label,
  value,
  deltaPercent,
  deltaLabel,
  loading = false,
  parts,
  note,
  tone,
}: KpiCardProps) {
  const positive = deltaPercent !== undefined && deltaPercent >= 0;
  return (
    <Card className="app-kpi">
      <span className="app-kpi__label">{label}</span>
      {loading ? (
        <Skeleton height="lg" />
      ) : (
        <span className={cx('app-kpi__value', tone && `app-kpi__value--${tone}`)}>{value}</span>
      )}
      {!loading && note ? <span className="app-kpi__note">{note}</span> : null}
      {!loading && deltaPercent !== undefined ? (
        <span
          className={cx('app-kpi__delta', positive ? 'app-kpi__delta--up' : 'app-kpi__delta--down')}
        >
          <span className="app-kpi__chip" dir="ltr">
            <span aria-hidden="true">{positive ? ARROW_UP : ARROW_DOWN}</span>
            <span>{Math.abs(deltaPercent)}%</span>
          </span>
          {deltaLabel ? <span className="app-kpi__delta-label">{deltaLabel}</span> : null}
        </span>
      ) : null}
      {!loading && parts && parts.length > 0 ? (
        <ul className="app-kpi__parts">
          {parts.map((part) => (
            <li key={part.key} className="app-kpi__part">
              <span className="app-kpi__dot" aria-hidden="true" />
              {part.label} <b>{part.value}</b>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
