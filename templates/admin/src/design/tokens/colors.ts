/** Brand + semantic colors of the design system (adjust per product). */
export const BRAND = {
  primary: '#6D28D9',
  primaryEnd: '#A855F7',
  onPrimary: '#FFFFFF',
  /** Counter on the active (gradient) nav item. */
  onPrimarySoft: 'rgba(255,255,255,.22)',
  /** Login brand panel (design 01): gradient start, rings, chip, tagline and body text on the gradient. */
  brandDeep: '#4C1D95',
  onBrandLine: 'rgba(255,255,255,.12)',
  onBrandChip: 'rgba(255,255,255,.16)',
  onBrandSoft: '#E9D5FF',
  onBrandText: '#EDE4FC',
  /** Rating star (design: #F59E0B in both themes). */
  star: '#F59E0B',
  /** Export menu file chips (design `Blocks`: XLS green, PDF rose, white text in both themes). */
  fileXlsx: '#23845F',
  fileCsv: '#585E6E',
  filePdf: '#C2386B',
} as const;

export const THEME_NAMES = ['light', 'dark'] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export type Palette = {
  page: string;
  card: string;
  surface: string;
  soft: string;
  ink: string;
  muted: string;
  faint: string;
  line: string;
  line2: string;
  accent: string;
  side: string;
  hover: string;
  skeleton: string;
  danger: string;
  success: string;
  warning: string;
  dangerSoft: string;
  overlay: string;
  focus: string;
};

export const PALETTES: Readonly<Record<ThemeName, Palette>> = {
  light: {
    page: '#F6F4FA',
    card: '#FFFFFF',
    surface: '#F8F7FB',
    soft: '#F3EEFB',
    ink: '#1F2233',
    muted: '#646B7B',
    faint: '#656972',
    line: '#EEEAF4',
    line2: '#DFD8EB',
    accent: '#6D28D9',
    side: '#FFFFFF',
    hover: '#FAF8FD',
    skeleton: '#EEEAF5',
    danger: '#C2386B',
    success: '#207856',
    warning: '#946010',
    dangerSoft: 'rgba(217,70,122,.05)',
    overlay: 'rgba(31,34,51,.45)',
    focus: '#A855F7',
  },
  dark: {
    page: '#14172B',
    card: '#1C1F37',
    surface: '#232744',
    soft: '#2C2553',
    ink: '#F8FAFC',
    muted: '#B6BBCB',
    faint: '#9196AC',
    line: 'rgba(255,255,255,.07)',
    line2: 'rgba(255,255,255,.13)',
    accent: '#C9AEF7',
    side: '#171A30',
    hover: 'rgba(255,255,255,.035)',
    skeleton: 'rgba(255,255,255,.07)',
    danger: '#F28BB0',
    success: '#5BD1A6',
    warning: '#F2C46B',
    dangerSoft: 'rgba(242,139,176,.08)',
    overlay: 'rgba(8,10,24,.65)',
    focus: '#C9AEF7',
  },
};

export const TONE_NAMES = ['green', 'amber', 'rose', 'grey', 'purple', 'violet'] as const;
export type ToneName = (typeof TONE_NAMES)[number];
export type ToneColors = Readonly<Record<ToneName, readonly [fg: string, bg: string]>>;

/** Status badge tones: [foreground, background]. */
export const TONES: Readonly<Record<ThemeName, ToneColors>> = {
  light: {
    green: ['#1D6E4F', 'rgba(46,158,120,.12)'],
    amber: ['#946010', 'rgba(245,158,11,.15)'],
    rose: ['#AC305F', 'rgba(217,70,122,.11)'],
    grey: ['#585E6E', 'rgba(107,114,128,.12)'],
    purple: ['#6D28D9', 'rgba(109,40,217,.09)'],
    violet: ['#9333EA', 'rgba(168,85,247,.12)'],
  },
  dark: {
    green: ['#5BD1A6', 'rgba(91,209,166,.13)'],
    amber: ['#F2C46B', 'rgba(242,196,107,.13)'],
    rose: ['#F28BB0', 'rgba(242,139,176,.13)'],
    grey: ['#B6BBCB', 'rgba(182,187,203,.11)'],
    purple: ['#C9AEF7', 'rgba(201,174,247,.13)'],
    violet: ['#D8B4FE', 'rgba(216,180,254,.13)'],
  },
};

/** Categorical chart palette derived from the brand (Design Script §0.1). */
export const CHART_PALETTES: Readonly<Record<ThemeName, readonly string[]>> = {
  light: ['#6D28D9', '#C4A5F5', '#A855F7', '#2E9E78', '#A3A8B8', '#E0B04A'],
  dark: ['#A78BFA', '#E9D5FF', '#7C3AED', '#5BD1A6', '#8A90A6', '#F2C46B'],
};
