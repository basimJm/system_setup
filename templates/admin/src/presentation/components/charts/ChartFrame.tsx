import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../core/Button';
import { Heading } from '../core/Heading';
import { Text } from '../core/Text';
import { downloadCsv, toCsv, type CsvCell } from '../../utils/csv';

export interface ChartTable {
  headers: readonly string[];
  rows: readonly (readonly CsvCell[])[];
}

export interface ChartFrameProps {
  title: string;
  description?: string;
  /** The same numbers the chart draws, as text: shown by "View data" and exported. */
  table: ChartTable;
  /** File name for the CSV export (without extension). */
  filename: string;
  children: ReactNode;
}

/** Chart wrapper (Admin PRD §2): title, the chart, "View data" table and CSV export. */
export function ChartFrame({ title, description, table, filename, children }: ChartFrameProps) {
  const { t } = useTranslation();
  const [showData, setShowData] = useState(false);
  const tableId = useId();
  return (
    <figure className="app-chart">
      <figcaption className="app-chart__head">
        <div>
          <Heading level={2} look={3}>
            {title}
          </Heading>
          {description ? <Text tone="muted">{description}</Text> : null}
        </div>
        <div className="app-row">
          <Button
            variant="secondary"
            size="sm"
            aria-pressed={showData}
            aria-controls={showData ? tableId : undefined}
            onClick={() => setShowData((v) => !v)}
          >
            {showData ? t('chart.hideData') : t('chart.viewData')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => downloadCsv(`${filename}.csv`, toCsv(table.headers, table.rows))}
          >
            {t('chart.exportCsv')}
          </Button>
        </div>
      </figcaption>
      {children}
      {showData ? (
        <div className="app-table-wrap" id={tableId}>
          <table className="app-table">
            <caption className="app-sr-only">{title}</caption>
            <thead>
              <tr>
                {table.headers.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>{cell ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </figure>
  );
}
