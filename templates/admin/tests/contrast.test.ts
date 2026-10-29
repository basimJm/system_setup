import { describe, expect, it } from 'vitest';
import { PALETTES, THEME_NAMES, TONES, TONE_NAMES, type ThemeName } from '@/design/tokens/colors';

type Rgb = readonly [number, number, number];
const AA = 4.5;

const hex = (color: string): Rgb => {
  const c = color.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)) as unknown as Rgb;
};
const channel = (v: number): number => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: Rgb): number =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const ratio = (a: Rgb, b: Rgb): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
/** A translucent tone background drawn over an opaque surface. */
const over = (rgba: string, base: Rgb): Rgb => {
  const m = /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(rgba);
  if (!m) throw new Error(`not rgba: ${rgba}`);
  const alpha = Number(m[4]);
  return [1, 2, 3].map((i, k) =>
    Math.round(alpha * Number(m[i]) + (1 - alpha) * base[k]!),
  ) as unknown as Rgb;
};

const SURFACES = ['card', 'surface', 'page', 'soft'] as const;
const TEXT = ['ink', 'muted', 'faint', 'accent', 'danger', 'success', 'warning'] as const;

describe.each(THEME_NAMES)('%s theme contrast (WCAG AA 4.5:1)', (theme: ThemeName) => {
  const palette = PALETTES[theme];

  it.each(TEXT)('%s text is readable on every surface', (name) => {
    for (const surface of SURFACES) {
      expect(
        ratio(hex(palette[name]), hex(palette[surface])),
        `${name} on ${surface}`,
      ).toBeGreaterThanOrEqual(AA);
    }
  });

  it.each(TONE_NAMES)('badge tone %s is readable on its own background over a card', (tone) => {
    const [fg, bg] = TONES[theme][tone];
    expect(ratio(hex(fg), over(bg, hex(palette.card)))).toBeGreaterThanOrEqual(AA);
  });

  it('white text on the primary button is readable', () => {
    expect(ratio(hex('#FFFFFF'), hex('#6D28D9'))).toBeGreaterThanOrEqual(AA);
  });
});
