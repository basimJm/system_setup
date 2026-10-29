import { formatNumber, formatPercent } from '@/domain/shared/format';
import { DONUT_INNER_RATIO, DONUT_SIZE } from '@/constants/charts';
import { useLanguage } from '../../hooks/useLanguage';
import { donutSlices, seriesColor } from '../../utils/chartMath';
import { ChartFrame } from './ChartFrame';
import type { ChartDatum } from './chartTypes';
import { Legend } from './Legend';

export interface DonutChartProps {
  title: string;
  description?: string;
  /** Headers of the data table: label, value, share. */
  headers: readonly [string, string, string];
  data: readonly ChartDatum[];
  filename: string;
  /** Text under the total in the middle of the ring (e.g. "bookings"). */
  centerLabel?: string;
}

export function DonutChart({
  title,
  description,
  headers,
  data,
  filename,
  centerLabel,
}: DonutChartProps) {
  const { language } = useLanguage();
  const total = data.reduce((sum, d) => sum + Math.max(d.value, 0), 0);
  const slices = donutSlices(
    data.map((d) => d.value),
    DONUT_SIZE,
    DONUT_INNER_RATIO,
  );
  const c = DONUT_SIZE / 2;
  return (
    <ChartFrame
      title={title}
      {...(description ? { description } : {})}
      filename={filename}
      table={{
        headers: [...headers],
        rows: data.map((d) => [
          d.label,
          d.value,
          total === 0 ? '0%' : `${String(Math.round((Math.max(d.value, 0) / total) * 100))}%`,
        ]),
      }}
    >
      <svg
        className="app-chart__svg app-chart__svg--donut"
        viewBox={`0 0 ${String(DONUT_SIZE)} ${String(DONUT_SIZE)}`}
        role="img"
        aria-label={title}
      >
        {slices.length === 0 ? (
          <circle cx={c} cy={c} r={c * 0.8} className="app-chart__empty" />
        ) : null}
        {slices.map((slice) => (
          <path key={slice.index} d={slice.path} fill={seriesColor(slice.index)}>
            <title>{`${data[slice.index]?.label ?? ''}: ${formatNumber(data[slice.index]?.value ?? 0, language)} (${formatPercent(slice.fraction, language)})`}</title>
          </path>
        ))}
        <text
          x={c}
          y={c}
          className="app-chart__total"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {formatNumber(total, language)}
        </text>
        {centerLabel ? (
          <text x={c} y={c + 22} className="app-chart__tick" textAnchor="middle">
            {centerLabel}
          </text>
        ) : null}
      </svg>
      <Legend items={data} />
    </ChartFrame>
  );
}
