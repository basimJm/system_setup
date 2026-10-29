import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHART_COLOR_COUNT, CHART_MAX_X_LABELS } from '@/constants/charts';
import { formatPercent } from '@/domain/shared/format';
import {
  axisTicks,
  bandCenter,
  donutSlices,
  funnelSteps,
  groupBars,
  heatShade,
  linePoints,
  niceCeil,
  plotArea,
  pointsAttribute,
  seriesColor,
  sparklinePoints,
  visibleLabelIndexes,
  yOf,
} from '@/presentation/utils/chartMath';
import { csvCell, downloadCsv, toCsv } from '@/presentation/utils/csv';

describe('niceCeil / axisTicks', () => {
  it.each([
    [0, 1],
    [-5, 1],
    [Number.NaN, 1],
    [0.7, 1],
    [1, 1],
    [1.2, 2],
    [2, 2],
    [3, 5],
    [5, 5],
    [5.1, 10],
    [87, 100],
    [260, 500],
    [1_234, 2_000],
  ])('niceCeil(%s) = %s', (input, expected) => expect(niceCeil(input)).toBe(expected));

  it('ticks run from 0 to the nice maximum in equal steps', () => {
    expect(axisTicks(260)).toEqual([0, 125, 250, 375, 500]);
    expect(axisTicks(0)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(axisTicks(87, 2)).toEqual([0, 50, 100]);
  });
});

describe('scales', () => {
  const area = plotArea();
  it('yOf maps 0 to the bottom, the top value to the top and clamps outside values', () => {
    expect(yOf(0, 100, area)).toBe(area.bottom);
    expect(yOf(100, 100, area)).toBe(area.top);
    expect(yOf(500, 100, area)).toBe(area.top);
    expect(yOf(-5, 100, area)).toBe(area.bottom);
    expect(yOf(5, 0, area)).toBe(area.bottom);
  });

  it('bands are equal and centred inside the plot', () => {
    expect(bandCenter(0, 4, area)).toBeCloseTo(area.left + area.width / 8, 1);
    expect(bandCenter(3, 4, area)).toBeCloseTo(area.right - area.width / 8, 1);
    expect(bandCenter(0, 0, area)).toBeGreaterThan(area.left);
  });

  it('linePoints keeps one point per value and pointsAttribute joins them', () => {
    const points = linePoints([0, 50, 100], 100, area);
    expect(points).toHaveLength(3);
    expect(points[0]!.y).toBe(area.bottom);
    expect(points[2]!.y).toBe(area.top);
    expect(
      pointsAttribute([
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ]),
    ).toBe('1,2 3,4');
    expect(pointsAttribute([])).toBe('');
  });

  it('thins x labels when there are many, always keeping the first', () => {
    expect(visibleLabelIndexes(5)).toEqual([0, 1, 2, 3, 4]);
    const many = visibleLabelIndexes(30);
    expect(many[0]).toBe(0);
    expect(many.length).toBeLessThanOrEqual(CHART_MAX_X_LABELS);
    expect(visibleLabelIndexes(0)).toEqual([]);
  });
});

describe('groupBars', () => {
  const area = plotArea();
  it('side by side: equal widths inside the band, heights follow values', () => {
    const bars = groupBars({
      index: 0,
      count: 2,
      values: [50, 100],
      top: 100,
      fill: 0.5,
      stacked: false,
      area,
    });
    expect(bars).toHaveLength(2);
    expect(bars[0]!.width).toBeCloseTo(bars[1]!.width, 1);
    expect(bars[1]!.height).toBeCloseTo(area.height, 1);
    expect(bars[0]!.height).toBeCloseTo(area.height / 2, 1);
    expect(bars[0]!.x + bars[0]!.width).toBeCloseTo(bars[1]!.x, 1);
  });

  it('stacked: one column, each segment starts where the previous ended', () => {
    const bars = groupBars({
      index: 1,
      count: 2,
      values: [40, 20],
      top: 100,
      fill: 0.5,
      stacked: true,
      area,
    });
    expect(bars[0]!.x).toBe(bars[1]!.x);
    expect(bars[1]!.y + bars[1]!.height).toBeCloseTo(bars[0]!.y, 1);
    expect(bars[0]!.height + bars[1]!.height).toBeCloseTo(area.height * 0.6, 1);
  });

  it('zero values give zero-height bars', () => {
    expect(
      groupBars({ index: 0, count: 1, values: [0], top: 10, fill: 1, stacked: false, area })[0]!
        .height,
    ).toBe(0);
  });
});

describe('donutSlices', () => {
  it('fractions add up to 1, zero values are skipped, indexes point back to the data', () => {
    const slices = donutSlices([30, 0, 70], 200, 0.6);
    expect(slices.map((s) => s.index)).toEqual([0, 2]);
    expect(slices.reduce((sum, s) => sum + s.fraction, 0)).toBeCloseTo(1, 5);
    expect(slices[0]!.path).toMatch(/^M[\d.-]+,[\d.-]+ A/);
  });

  it('nothing to draw for empty, all-zero or negative data', () => {
    expect(donutSlices([], 200, 0.6)).toEqual([]);
    expect(donutSlices([0, 0], 200, 0.6)).toEqual([]);
    expect(donutSlices([-3], 200, 0.6)).toEqual([]);
  });

  it('a single value is a full ring, not a degenerate arc', () => {
    const [slice] = donutSlices([42], 200, 0.6);
    expect(slice!.fraction).toBe(1);
    expect(slice!.path).toContain('A100,100 0 1 1');
  });

  it('a slice larger than half uses the large-arc flag', () => {
    expect(donutSlices([80, 20], 200, 0.6)[0]!.path).toContain('0 1 1');
    expect(donutSlices([20, 80], 200, 0.6)[0]!.path).toContain('0 0 1');
  });
});

describe('funnelSteps / heatShade / sparkline', () => {
  it('funnel shares are relative to the first and to the previous step', () => {
    const steps = funnelSteps([1000, 500, 250]);
    expect(steps.map((s) => s.fromFirst)).toEqual([1, 0.5, 0.25]);
    expect(steps.map((s) => s.fromPrevious)).toEqual([1, 0.5, 0.5]);
    expect(steps.map((s) => s.widthRatio)).toEqual([1, 0.5, 0.25]);
  });

  it('funnel never exceeds 100% and survives zeros and an empty list', () => {
    expect(funnelSteps([100, 150])[1]!.widthRatio).toBe(1);
    expect(funnelSteps([0, 5]).map((s) => s.widthRatio)).toEqual([0, 0]);
    expect(funnelSteps([10, 0, 5])[2]!.fromPrevious).toBe(0);
    expect(funnelSteps([])).toEqual([]);
  });

  it.each([
    [0, 0],
    [0.19, 0],
    [0.2, 1],
    [0.5, 2],
    [0.99, 4],
    [1, 4],
  ])('heatShade(%s) in 0..1 = %s', (value, shade) => expect(heatShade(value, 0, 1)).toBe(shade));

  it('heatShade clamps and gives a flat range the middle shade', () => {
    expect(heatShade(5, 0, 1)).toBe(4);
    expect(heatShade(-5, 0, 1)).toBe(0);
    expect(heatShade(3, 3, 3)).toBe(2);
  });

  it('sparkline spans the box, flat data is centred, one point is centred', () => {
    const points = sparklinePoints([1, 3, 2], 100, 20, 2);
    expect(points[0]!.x).toBe(2);
    expect(points[2]!.x).toBe(98);
    expect(points[1]!.y).toBe(2);
    expect(points[0]!.y).toBe(18);
    expect(sparklinePoints([5, 5], 100, 20)[0]!.y).toBe(10);
    expect(sparklinePoints([5], 100, 20)[0]).toEqual({ x: 50, y: 10 });
    expect(sparklinePoints([], 100, 20)).toEqual([]);
  });

  it('series colours come from the CSS palette and repeat after the palette size', () => {
    expect(seriesColor(0)).toBe('var(--chart-1)');
    expect(seriesColor(CHART_COLOR_COUNT)).toBe('var(--chart-1)');
    expect(seriesColor(CHART_COLOR_COUNT - 1)).toBe(`var(--chart-${String(CHART_COLOR_COUNT)})`);
  });

  it('formatPercent rounds to a whole percent in the language digits', () => {
    expect(formatPercent(0.256, 'en')).toBe('26%');
    expect(formatPercent(0.256, 'ar')).toBe('٢٦%');
  });
});

describe('csv', () => {
  it.each([
    ['plain', 'plain'],
    ['a,b', '"a,b"'],
    ['say "hi"', '"say ""hi"""'],
    ['two\nlines', '"two\nlines"'],
    [null, ''],
    [undefined, ''],
    [12.5, '12.5'],
    [-5, '-5'],
    ['-5', '-5'],
    ['=SUM(A1)', "'=SUM(A1)"],
    ['+1+1', "'+1+1"],
    ['@cmd', "'@cmd"],
    ['-cmd', "'-cmd"],
    ['=1,2', `"'=1,2"`],
  ])('csvCell(%j) = %j', (input, expected) => expect(csvCell(input)).toBe(expected));

  it('toCsv writes headers then rows separated by CRLF', () => {
    expect(
      toCsv(
        ['a', 'b'],
        [
          [1, 'x,y'],
          [2, null],
        ],
      ),
    ).toBe('a,b\r\n1,"x,y"\r\n2,');
    expect(toCsv(['a'], [])).toBe('a');
  });

  describe('downloadCsv', () => {
    afterEach(() => vi.restoreAllMocks());
    it('saves a UTF-8 file with a BOM through a temporary link and releases the URL', async () => {
      const create = vi.fn(() => 'blob:fake');
      const revoke = vi.fn();
      Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
      const click = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined);
      downloadCsv('data.csv', 'a,b');
      const blob = (create.mock.calls[0] as unknown as [Blob])[0];
      expect(blob.type).toContain('text/csv');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)).toBe('\uFEFFa,b');
      expect(click).toHaveBeenCalledTimes(1);
      expect(revoke).toHaveBeenCalledWith('blob:fake');
      expect(document.querySelector('a[download]')).toBeNull();
    });
  });
});
