import { formatNumber } from '@/domain/shared/format';
import { CHART_HEIGHT, CHART_WIDTH } from '@/constants/charts';
import { useLanguage } from '../../hooks/useLanguage';
import {
  axisTicks,
  linePoints,
  plotArea,
  pointsAttribute,
  seriesColor,
} from '../../utils/chartMath';
import { Axes } from './Axes';
import { ChartFrame } from './ChartFrame';
import type { ChartSeries } from './chartTypes';
import { Legend } from './Legend';

export interface LineChartProps {
  title: string;
  description?: string;
  /** Header of the first column of the data table (e.g. "Day"). */
  categoryHeader: string;
  labels: readonly string[];
  series: readonly ChartSeries[];
  filename: string;
}

export function LineChart({
  title,
  description,
  categoryHeader,
  labels,
  series,
  filename,
}: LineChartProps) {
  const { language } = useLanguage();
  const area = plotArea();
  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const ticks = axisTicks(max);
  const top = ticks[ticks.length - 1] ?? 1;
  return (
    <ChartFrame
      title={title}
      {...(description ? { description } : {})}
      filename={filename}
      table={{
        headers: [categoryHeader, ...series.map((s) => s.label)],
        rows: labels.map((label, i) => [label, ...series.map((s) => s.values[i] ?? '')]),
      }}
    >
      <svg
        className="app-chart__svg"
        viewBox={`0 0 ${String(CHART_WIDTH)} ${String(CHART_HEIGHT)}`}
        role="img"
        aria-label={title}
      >
        <Axes max={max} labels={labels} />
        {series.map((s, index) => {
          const points = linePoints(s.values, top, area);
          return (
            <g key={s.key} className="app-chart__series" style={{ color: seriesColor(index) }}>
              <polyline points={pointsAttribute(points)} className="app-chart__line" />
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3} className="app-chart__dot">
                  <title>{`${s.label} · ${labels[i] ?? ''}: ${formatNumber(s.values[i] ?? 0, language)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <Legend items={series} />
    </ChartFrame>
  );
}
