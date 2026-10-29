import type { ReactNode } from 'react';

export type SortDirection = 'asc' | 'desc';
export interface SortState {
  key: string;
  direction: SortDirection;
}

export type Density = 'comfortable' | 'compact';

export interface Column<Row> {
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
  sortable?: boolean;
  /** Numeric/ID cells stay left-to-right inside RTL pages. */
  ltr?: boolean;
}

/** Bulk selection by row key; the set may hold keys of other pages (the page owner decides what to do with them). */
export interface SelectionCore {
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
}

export interface TableSelection<Row> extends SelectionCore {
  /** Accessible name of a row's checkbox (e.g. the row name). */
  rowLabel: (row: Row) => string;
}
