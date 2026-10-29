import { formatNumber, formatPercent } from '@/domain/shared/format';
import { useLanguage } from '../../hooks/useLanguage';
import { funnelSteps, seriesColor } from '../../utils/chartMath';
import { ChartFrame } from './ChartFrame';
import type { ChartDatum } from './chartTypes';

export interface FunnelChartProps {
  title: string;
  description?: string;
  /** Headers of the data table: step, count, share of the first step, share of the previous step. */
  headers: readonly [string, string, string, string];
  steps: readonly ChartDatum[];
  filename: string;
}

/** Conversion funnel: one bar per step, each as wide as its share of the first step. */
export function FunnelChart({ title, description, headers, steps, filename }: FunnelChartProps) {
  const { language } = useLanguage();
  const shares = funnelSteps(steps.map((s) => s.value));
  const pct = (ratio: number) => `${String(Math.round(ratio * 100))}%`;
  return (
    <ChartFrame
      title={title}
      {...(description ? { description } : {})}
      filename={filename}
      table={{
        headers: [...headers],
        rows: steps.map((s, i) => [
          s.label,
          s.value,
          pct(shares[i]?.fromFirst ?? 0),
          pct(shares[i]?.fromPrevious ?? 0),
        ]),
      }}
    >
      <ol className="app-funnel" aria-label={title}>
        {steps.map((step, i) => {
          const share = shares[i];
          return (
            <li key={step.key} className="app-funnel__step">
              <span className="app-funnel__label">{step.label}</span>
              <span className="app-funnel__track">
                <span
                  className="app-funnel__bar"
                  style={{ width: pct(share?.widthRatio ?? 0), background: seriesColor(0) }}
                />
              </span>
              <span className="app-funnel__value">
                {formatNumber(step.value, language)}
                <span className="app-funnel__rate">
                  {' '}
                  · {formatPercent(share?.fromPrevious ?? 0, language)}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </ChartFrame>
  );
}
