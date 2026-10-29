import { formatNumber } from '@/domain/shared/format';
import { useLanguage } from '../../hooks/useLanguage';
import { axisTicks, bandCenter, plotArea, visibleLabelIndexes, yOf } from '../../utils/chartMath';

export interface AxesProps {
  /** Largest value the chart draws (before rounding up to a nice tick). */
  max: number;
  labels: readonly string[];
}

/** Horizontal grid lines with value labels on the left, category labels underneath. Numbers follow the language. */
export function Axes({ max, labels }: AxesProps) {
  const { language } = useLanguage();
  const area = plotArea();
  const ticks = axisTicks(max);
  const top = ticks[ticks.length - 1] ?? 1;
  return (
    <g className="app-chart__axes">
      {ticks.map((tick) => {
        const y = yOf(tick, top, area);
        return (
          <g key={tick}>
            <line x1={area.left} x2={area.right} y1={y} y2={y} className="app-chart__grid" />
            <text
              x={area.left - 8}
              y={y}
              className="app-chart__tick"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {formatNumber(tick, language)}
            </text>
          </g>
        );
      })}
      {visibleLabelIndexes(labels.length).map((i) => (
        <text
          key={i}
          x={bandCenter(i, labels.length, area)}
          y={area.bottom + 20}
          className="app-chart__tick"
          textAnchor="middle"
        >
          {labels[i]}
        </text>
      ))}
    </g>
  );
}
