import { formatPercent } from '@/domain/shared/format';
import { useLanguage } from '../../hooks/useLanguage';
import { heatShade } from '../../utils/chartMath';
import { ChartFrame } from './ChartFrame';

export interface CohortRow {
  key: string;
  label: string;
  /** Retention per period as a ratio 0..1 (empty for periods that have not happened yet). */
  values: readonly (number | null)[];
}

export interface CohortHeatmapProps {
  title: string;
  description?: string;
  /** Header of the first column (the cohort). */
  cohortHeader: string;
  columnLabels: readonly string[];
  rows: readonly CohortRow[];
  filename: string;
}

/** Retention heatmap: a real table (one row per cohort) with cell shade by value. */
export function CohortHeatmap({
  title,
  description,
  cohortHeader,
  columnLabels,
  rows,
  filename,
}: CohortHeatmapProps) {
  const { language } = useLanguage();
  const all = rows.flatMap((r) => r.values).filter((v): v is number => v !== null);
  const min = Math.min(...all);
  const max = Math.max(...all);
  return (
    <ChartFrame
      title={title}
      {...(description ? { description } : {})}
      filename={filename}
      table={{
        headers: [cohortHeader, ...columnLabels],
        rows: rows.map((r) => [
          r.label,
          ...r.values.map((v) => (v === null ? '' : `${String(Math.round(v * 100))}%`)),
        ]),
      }}
    >
      <div className="app-table-wrap">
        <table className="app-heatmap">
          <caption className="app-sr-only">{title}</caption>
          <thead>
            <tr>
              <th scope="col">{cohortHeader}</th>
              {columnLabels.map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                {columnLabels.map((label, i) => {
                  const value = row.values[i] ?? null;
                  return value === null ? (
                    <td key={label} className="app-heat app-heat--none" />
                  ) : (
                    <td
                      key={label}
                      className={`app-heat app-heat--${String(heatShade(value, min, max))}`}
                    >
                      {formatPercent(value, language)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartFrame>
  );
}
