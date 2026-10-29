/** Number of categorical chart colours (`--chart-1` ... `--chart-6`); series beyond it repeat the palette. */
export const CHART_COLOR_COUNT = 6;
/** Drawing space of the SVG charts; they scale with their container through the viewBox. */
export const CHART_WIDTH = 640;
export const CHART_HEIGHT = 300;
export const CHART_MARGIN = { top: 16, right: 16, bottom: 36, left: 56 } as const;
export const CHART_TICK_COUNT = 4;
/** Most x-axis labels drawn; with more points the labels are thinned out. */
export const CHART_MAX_X_LABELS = 8;
export const DONUT_SIZE = 220;
export const DONUT_INNER_RATIO = 0.62;
export const HEATMAP_STEPS = 5;
export const SPARKLINE_WIDTH = 96;
export const SPARKLINE_HEIGHT = 28;
export const BAR_GROUP_FILL = 0.7;
export const CSV_MIME = 'text/csv;charset=utf-8';
export const CSV_BOM = '﻿';
/** A spreadsheet runs cells starting with these as formulas: such cells get a leading apostrophe. */
export const CSV_FORMULA_PREFIXES = ['=', '+', '-', '@'] as const;
