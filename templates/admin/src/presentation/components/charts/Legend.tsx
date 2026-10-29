import { seriesColor } from '../../utils/chartMath';

export interface LegendItem {
  key: string;
  label: string;
}

/** Colour key for a chart; colours repeat the chart palette by position. */
export function Legend({ items }: { items: readonly LegendItem[] }) {
  return (
    <ul className="app-legend">
      {items.map((item, index) => (
        <li key={item.key} className="app-legend__item">
          <span
            className="app-legend__swatch"
            style={{ background: seriesColor(index) }}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
