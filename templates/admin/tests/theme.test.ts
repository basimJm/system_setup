import { beforeEach, describe, expect, it } from 'vitest';
import { buildCssVars } from '@/design/theme/cssVars';
import { applyThemeToDocument } from '@/design/theme/applyTheme';
import { resolveTheme } from '@/design/theme/themeMode';
import { PALETTES, THEME_NAMES, TONES, TONE_NAMES, CHART_PALETTES } from '@/design/tokens/colors';
import { listFiles, read, SRC } from './helpers/files';

describe('design tokens', () => {
  it('light and dark define the same tokens', () => {
    expect(Object.keys(PALETTES.dark).sort()).toEqual(Object.keys(PALETTES.light).sort());
    expect(Object.keys(TONES.dark)).toEqual(Object.keys(TONES.light));
    expect(CHART_PALETTES.dark).toHaveLength(CHART_PALETTES.light.length);
  });

  it('every tone has a foreground and background in both themes', () => {
    for (const theme of THEME_NAMES) {
      for (const tone of TONE_NAMES) expect(TONES[theme][tone]).toHaveLength(2);
    }
  });

  it('builds a CSS variable for every palette entry and flips with direction', () => {
    const vars = buildCssVars('dark', 'rtl');
    for (const key of Object.keys(PALETTES.dark)) {
      expect(vars[`--c-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`], key).toBeDefined();
    }
    expect(vars['--c-page']).toBe(PALETTES.dark.page);
    expect(vars['--flip']).toBe('-1');
    expect(buildCssVars('light', 'ltr')['--flip']).toBe('1');
    expect(buildCssVars('light', 'rtl')['--font-family']).toContain('IBM Plex Sans Arabic');
  });

  it('uses well-formed variable names (no "--space--1")', () => {
    for (const name of Object.keys(buildCssVars('light', 'ltr')))
      expect(name).toMatch(/^--[a-z]+(-[a-z0-9]+)*$/);
  });

  it('every var(--x) used in a stylesheet is defined by the tokens', () => {
    // Element-scoped values a component sets inline from constants (analytics board cell spans, ADM-099).
    const elementVars = ['--span', '--span-md'];
    const defined = new Set([...Object.keys(buildCssVars('light', 'rtl')), ...elementVars]);
    const used = new Set<string>();
    for (const file of listFiles(SRC, /\.css$/)) {
      for (const m of read(file).matchAll(/var\((--[\w-]+)\)/g)) used.add(m[1] as string);
    }
    expect([...used].filter((v) => !defined.has(v))).toEqual([]);
  });
});

describe('theme application', () => {
  beforeEach(() => document.documentElement.removeAttribute('style'));

  it('resolves system mode', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('writes tokens, theme and direction on <html>', () => {
    applyThemeToDocument('dark', 'rtl');
    const root = document.documentElement;
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(root.getAttribute('dir')).toBe('rtl');
    expect(root.style.getPropertyValue('--c-page')).toBe(PALETTES.dark.page);
    applyThemeToDocument('light', 'ltr');
    expect(root.style.getPropertyValue('--c-page')).toBe(PALETTES.light.page);
    expect(root.getAttribute('dir')).toBe('ltr');
  });
});
