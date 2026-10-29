import type { Direction } from '@/constants/i18n';
import { BRAND, CHART_PALETTES, PALETTES, TONES, type ThemeName } from '../tokens/colors';
import {
  FONT_FAMILIES,
  FONT_SIZES,
  FONT_WEIGHTS,
  LINE_HEIGHT,
  LINE_HEIGHT_TIGHT,
  MOTION,
  OPACITY,
  RADIUS,
  ROOT_FONT_SIZE,
  SHADOWS,
  SIZES,
  SPACING,
  TRACKING,
  Z_INDEX,
} from '../tokens/layout';

export type CssVars = Record<string, string>;

const kebab = (key: string): string => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const prefixed = (prefix: string, source: Readonly<Record<string, string>>): CssVars =>
  Object.fromEntries(Object.entries(source).map(([k, v]) => [`--${prefix}-${kebab(k)}`, v]));

/** Every token the stylesheets use, as CSS custom properties. The single bridge from TS tokens to CSS. */
export function buildCssVars(theme: ThemeName, direction: Direction): CssVars {
  const tones: CssVars = {};
  for (const [name, [fg, bg]] of Object.entries(TONES[theme])) {
    tones[`--tone-${name}-fg`] = fg;
    tones[`--tone-${name}-bg`] = bg;
  }
  const chart: CssVars = Object.fromEntries(
    CHART_PALETTES[theme].map((color, i) => [`--chart-${String(i + 1)}`, color]),
  );
  return {
    '--root-font-size': ROOT_FONT_SIZE,
    ...prefixed('c', PALETTES[theme]),
    '--c-primary': BRAND.primary,
    '--c-primary-end': BRAND.primaryEnd,
    '--c-on-primary': BRAND.onPrimary,
    '--c-on-primary-soft': BRAND.onPrimarySoft,
    '--c-brand-deep': BRAND.brandDeep,
    '--c-on-brand-line': BRAND.onBrandLine,
    '--c-on-brand-chip': BRAND.onBrandChip,
    '--c-on-brand-soft': BRAND.onBrandSoft,
    '--c-on-brand-text': BRAND.onBrandText,
    '--c-star': BRAND.star,
    '--c-file-xlsx': BRAND.fileXlsx,
    '--c-file-csv': BRAND.fileCsv,
    '--c-file-pdf': BRAND.filePdf,
    ...tones,
    ...chart,
    ...prefixed('space', SPACING),
    ...prefixed('radius', RADIUS),
    ...prefixed('size', SIZES),
    ...prefixed('fs', FONT_SIZES),
    ...prefixed('fw', FONT_WEIGHTS),
    ...prefixed('tracking', TRACKING),
    ...prefixed('motion', MOTION),
    ...prefixed('opacity', OPACITY),
    ...prefixed('z', Z_INDEX),
    ...prefixed('shadow', SHADOWS[theme]),
    '--lh': LINE_HEIGHT,
    '--lh-tight': LINE_HEIGHT_TIGHT,
    '--font-family': direction === 'rtl' ? FONT_FAMILIES.arabic : FONT_FAMILIES.latin,
    '--font-display': FONT_FAMILIES.display,
    '--font-numeric': FONT_FAMILIES.numeric,
    '--flip': direction === 'rtl' ? '-1' : '1',
  };
}
