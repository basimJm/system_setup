import { formatNumber } from '@/domain/shared/format';
import { BAR_GROUP_FILL, CHART_HEIGHT, CHART_WIDTH } from '@/constants/charts';
import { useLanguage } from '../../hooks/useLanguage';
import { axisTicks, groupBars, plotArea, seriesColor } from '../../utils/chartMath';
import { Axes } from './Axes';
import { ChartFrame } from './ChartFrame';
import type { ChartSeries } from './chartTypes';
import { Legend } from './Legend';

export interface BarChartProps {
  title: string;
  description?: string;
  categoryHeader: string;
  labels: readonly string[];
  series: readonly ChartSeries[];
  filename: string;
  /** Stack the series on top of each other instead of side by side. */
  stacked?: boolean;
}

export function BarChart({
  title,
  description,
  categoryHeader,
  labels,
  series,
  filename,
  stacked = false,
}: BarChartProps) {
  const { language } = useLanguage();
  const area = plotArea();
  const perCategory = labels.map((_, i) => series.map((s) => Math.max(s.values[i] ?? 0, 0)));
  const max = Math.max(
    0,
    ...perCategory.map((values) =>
      stacked ? values.reduce((a, b) => a + b, 0) : Math.max(0, ...values),
    ),
  );
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
        {perCategory.map((values, i) =>
          groupBars({
            index: i,
            count: labels.length,
            values,
            top,
            fill: BAR_GROUP_FILL,
            stacked,
            area,
          }).map((rect, s) => (
            <rect
              key={`${String(i)}-${String(s)}`}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              rx={2}
              fill={seriesColor(s)}
            >
              <title>{`${series[s]?.label ?? ''} · ${labels[i] ?? ''}: ${formatNumber(values[s] ?? 0, language)}`}</title>
            </rect>
          )),
        )}
      </svg>
      <Legend items={series} />
    </ChartFrame>
  );
}
