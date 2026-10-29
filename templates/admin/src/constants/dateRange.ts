/** Presets of the date range picker, in display order (Admin PRD §2). */
export const DATE_PRESETS = [
  'today',
  'yesterday',
  'last7',
  'last30',
  'thisMonth',
  'lastMonth',
  'thisYear',
  'custom',
] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];
export type RangePreset = Exclude<DatePreset, 'custom'>;
export const DEFAULT_DATE_PRESET: RangePreset = 'last7';
export const LAST_7_DAYS = 7;
export const LAST_30_DAYS = 30;

/** Export file formats, as the server's export jobs name them. */
export const EXPORT_FORMATS = ['XLSX', 'CSV', 'PDF'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
