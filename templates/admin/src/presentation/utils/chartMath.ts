import {
  CHART_COLOR_COUNT,
  CHART_HEIGHT,
  CHART_MARGIN,
  CHART_MAX_X_LABELS,
  CHART_TICK_COUNT,
  CHART_WIDTH,
  HEATMAP_STEPS,
} from '@/constants/charts';

export interface Point {
  readonly x: number;
  readonly y: number;
}

const round = (value: number): number => Math.round(value * 100) / 100;

/** Smallest "nice" number (1, 2, 5 x 10^n) that is >= `max`; 1 for zero or negative input. */
export function niceCeil(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const exponent = Math.floor(Math.log10(max));
  const base = 10 ** exponent;
  const fraction = max / base;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * base;
}

/** Axis ticks from 0 to the nice maximum: `[0, step, ..., top]`. */
export function axisTicks(max: number, count: number = CHART_TICK_COUNT): number[] {
  const top = niceCeil(max);
  return Array.from({ length: count + 1 }, (_, i) => round((top * i) / count));
}

export interface PlotArea {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

export const plotArea = (): PlotArea => ({
  left: CHART_MARGIN.left,
  right: CHART_WIDTH - CHART_MARGIN.right,
  top: CHART_MARGIN.top,
  bottom: CHART_HEIGHT - CHART_MARGIN.bottom,
  width: CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right,
  height: CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom,
});

/** Vertical position of `value` on an axis that runs 0..`top` over the plot height. */
export function yOf(value: number, top: number, area: PlotArea = plotArea()): number {
  const ratio = top <= 0 ? 0 : Math.min(Math.max(value / top, 0), 1);
  return round(area.bottom - ratio * area.height);
}

/** Evenly spaced x for `count` categories (centres of equal bands). */
export function bandCenter(index: number, count: number, area: PlotArea = plotArea()): number {
  return round(area.left + ((index + 0.5) * area.width) / Math.max(count, 1));
}

export function linePoints(
  values: readonly number[],
  top: number,
  area: PlotArea = plotArea(),
): Point[] {
  return values.map((value, index) => ({
    x: bandCenter(index, values.length, area),
    y: yOf(value, top, area),
  }));
}

export const pointsAttribute = (points: readonly Point[]): string =>
  points.map((p) => `${String(p.x)},${String(p.y)}`).join(' ');

/** Indexes of the x labels to draw: all when few, otherwise evenly thinned (first one always kept). */
export function visibleLabelIndexes(count: number, max: number = CHART_MAX_X_LABELS): number[] {
  const step = Math.max(1, Math.ceil(count / max));
  return Array.from({ length: count }, (_, i) => i).filter((i) => i % step === 0);
}

export interface BarRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface GroupBarsInput {
  /** Position of the category among `count` categories. */
  readonly index: number;
  readonly count: number;
  /** One value per series for this category. */
  readonly values: readonly number[];
  /** Top of the value axis. */
  readonly top: number;
  /** Share of the band the group occupies (0..1). */
  readonly fill: number;
  /** Stack the series instead of placing them side by side. */
  readonly stacked: boolean;
  readonly area?: PlotArea;
}

/** Bars of one category group: `values.length` side by side, or stacked when `stacked`. */
export function groupBars({
  index,
  count,
  values,
  top,
  fill,
  stacked,
  area = plotArea(),
}: GroupBarsInput): BarRect[] {
  const band = area.width / Math.max(count, 1);
  const groupWidth = band * fill;
  const start = area.left + index * band + (band - groupWidth) / 2;
  if (stacked) {
    let acc = 0;
    return values.map((value) => {
      const from = yOf(acc, top, area);
      acc += value;
      const to = yOf(acc, top, area);
      return { x: round(start), y: to, width: round(groupWidth), height: round(from - to) };
    });
  }
  const barWidth = groupWidth / Math.max(values.length, 1);
  return values.map((value, i) => {
    const y = yOf(value, top, area);
    return {
      x: round(start + i * barWidth),
      y,
      width: round(barWidth),
      height: round(area.bottom - y),
    };
  });
}

export interface DonutSlice {
  readonly index: number;
  readonly fraction: number;
  readonly path: string;
}

const polar = (cx: number, cy: number, radius: number, angle: number): Point => ({
  x: round(cx + radius * Math.cos(angle)),
  y: round(cy + radius * Math.sin(angle)),
});

/** Donut segments clockwise from 12 o'clock. Zero values draw nothing; a single 100% slice is a full ring. */
export function donutSlices(
  values: readonly number[],
  size: number,
  innerRatio: number,
): DonutSlice[] {
  const total = values.reduce((sum, v) => sum + Math.max(v, 0), 0);
  if (total <= 0) return [];
  const c = size / 2;
  const outer = c;
  const inner = outer * innerRatio;
  const slices: DonutSlice[] = [];
  let angle = -Math.PI / 2;
  values.forEach((raw, index) => {
    const value = Math.max(raw, 0);
    if (value === 0) return;
    const fraction = value / total;
    const sweep = fraction * Math.PI * 2;
    const full = fraction >= 0.9999;
    const end = angle + (full ? Math.PI * 2 - 0.0001 : sweep);
    const [a, b, d, e] = [
      polar(c, c, outer, angle),
      polar(c, c, outer, end),
      polar(c, c, inner, end),
      polar(c, c, inner, angle),
    ];
    const large = sweep > Math.PI ? 1 : 0;
    const path = `M${String(a.x)},${String(a.y)} A${String(outer)},${String(outer)} 0 ${String(large)} 1 ${String(b.x)},${String(b.y)} L${String(d.x)},${String(d.y)} A${String(inner)},${String(inner)} 0 ${String(large)} 0 ${String(e.x)},${String(e.y)} Z`;
    slices.push({ index, fraction, path });
    angle += sweep;
  });
  return slices;
}

export interface FunnelStep {
  readonly index: number;
  /** Width of the bar relative to the first step (0..1). */
  readonly widthRatio: number;
  /** Share of the previous step that continued (1 for the first step). */
  readonly fromPrevious: number;
  readonly fromFirst: number;
}

export function funnelSteps(values: readonly number[]): FunnelStep[] {
  const first = values[0] ?? 0;
  return values.map((value, index) => {
    const previous = index === 0 ? value : (values[index - 1] ?? 0);
    return {
      index,
      widthRatio: first <= 0 ? 0 : Math.min(value / first, 1),
      fromPrevious: previous <= 0 ? (index === 0 ? 1 : 0) : Math.min(value / previous, 1),
      fromFirst: first <= 0 ? 0 : Math.min(value / first, 1),
    };
  });
}

/** Heatmap shade 0..steps-1 for `value` between `min` and `max`; a flat range gets the middle shade. */
export function heatShade(
  value: number,
  min: number,
  max: number,
  steps: number = HEATMAP_STEPS,
): number {
  if (max <= min) return Math.floor((steps - 1) / 2);
  const ratio = Math.min(Math.max((value - min) / (max - min), 0), 1);
  return Math.min(steps - 1, Math.floor(ratio * steps));
}

/** Points of a sparkline in a `width` x `height` box with `pad` around it. */
export function sparklinePoints(
  values: readonly number[],
  width: number,
  height: number,
  pad = 2,
): Point[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  return values.map((value, i) => ({
    x: round(values.length === 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (values.length - 1)),
    y: round(span === 0 ? height / 2 : height - pad - ((value - min) / span) * (height - 2 * pad)),
  }));
}

/** CSS colour of the `index`-th series: the palette repeats after `CHART_COLOR_COUNT` series. */
export const seriesColor = (index: number): string =>
  `var(--chart-${String((index % CHART_COLOR_COUNT) + 1)})`;
