import { SPARKLINE_HEIGHT, SPARKLINE_WIDTH } from '@/constants/charts';
import { pointsAttribute, seriesColor, sparklinePoints } from '../../utils/chartMath';

export interface SparklineProps {
  values: readonly number[];
  /** What the line shows, read by screen readers ("Bookings, last 7 days"). */
  label: string;
}

/** Tiny trend line for KPI cards. Inline, no frame: the card already shows the number. */
export function Sparkline({ values, label }: SparklineProps) {
  const points = sparklinePoints(values, SPARKLINE_WIDTH, SPARKLINE_HEIGHT);
  return (
    <svg
      className="app-sparkline"
      viewBox={`0 0 ${String(SPARKLINE_WIDTH)} ${String(SPARKLINE_HEIGHT)}`}
      role="img"
      aria-label={label}
    >
      {points.length > 1 ? (
        <polyline
          points={pointsAttribute(points)}
          className="app-chart__line"
          style={{ color: seriesColor(0) }}
        />
      ) : null}
      {points.length === 1 && points[0] ? (
        <circle cx={points[0].x} cy={points[0].y} r={2} style={{ fill: seriesColor(0) }} />
      ) : null}
    </svg>
  );
}
