export interface ChartSeries {
  key: string;
  label: string;
  values: readonly number[];
}

export interface ChartDatum {
  key: string;
  label: string;
  value: number;
}
