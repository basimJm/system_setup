/** Spacing, radii, sizes, typography, motion and elevation. All lengths are rem so the UI scales. */
export const ROOT_FONT_SIZE = 'clamp(0.875rem, 0.8rem + 0.25vw, 1.0625rem)';

export const SPACING = {
  0: '0.125rem',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.5rem',
  6: '2rem',
  7: '3rem',
} as const;

export const RADIUS = {
  xs: '0.375rem',
  chip: '0.4375rem',
  sm: '0.5rem',
  control: '0.625rem',
  md: '0.75rem',
  popup: '0.875rem',
  lg: '1rem',
  pill: '62.4375rem',
} as const;

export const SIZES = {
  hairline: '1px',
  focusRing: '2px',
  control: '2.5rem',
  controlSm: '2rem',
  button: '2.375rem',
  buttonSm: '2rem',
  field: '3rem',
  icon: '1.25rem',
  iconSm: '1rem',
  iconLg: '1.75rem',
  sidebar: '16rem',
  sidebarCollapsed: '4.75rem',
  topbar: '4rem',
  navItem: '2.5rem',
  navSub: '2.125rem',
  navDot: '0.375rem',
  counter: '1.25rem',
  liveDot: '0.4375rem',
  brandIcon: '2.5rem',
  brandIconLg: '3.375rem',
  adminAvatar: '2.125rem',
  adminAvatarSm: '1.75rem',
  kpiMin: '6.125rem',
  /** Smallest KPI tile on the analytics boards (design `min:150`). */
  kpiTile: '9.375rem',
  otpBox: '3.25rem',
  otpBoxH: '3.625rem',
  stateIcon: '3.25rem',
  brandRing: '32.5rem',
  brandRingSm: '23.75rem',
  contentMax: '90rem',
  modal: '32rem',
  modalMax: '90dvh',
  drawer: '28rem',
  aside: '20rem',
  fieldMin: '16rem',
  chartMax: '20rem',
  donutMax: '14rem',
  sparklineWidth: '6rem',
  sparklineHeight: '1.75rem',
  funnelLabel: '8rem',
  jsonMax: '24rem',
  mediaPreview: '12rem',
  mediaStage: '28rem',
  phoneWidth: '22rem',
  phoneHeight: '40rem',
  toast: '22rem',
  popupMax: '16rem',
  /** Top-bar bell dropdown (design 360 px). */
  bellPanel: '22.5rem',
  popupMin: '12rem',
  searchMax: '32.5rem',
  /** Design table card header: title block basis, search box width, search height. */
  listcardTitle: '12.5rem',
  listcardSearch: '13.75rem',
  listcardToolLg: '2.125rem',
  tableMin: '40rem',
  skeletonLine: '1rem',
  spinner: '1.5rem',
  touchTarget: '2.75rem',
  cardMin: '15rem',
  /** Design card grid (card grids): card min width and artwork height. */
  gridCard: '16.25rem',
  gridCardMedia: '8.125rem',
  authCard: '25rem',
  brandPanel: '34rem',
  segmentedItem: '2.25rem',
  badgeDot: '0.5rem',
  logo: '2.5rem',
  tableCellMin: '8rem',
  avatarSm: '2rem',
  avatar: '2.5rem',
  avatarLg: '3.5rem',
  tooltipMax: '18rem',
  keyValueLabel: '10rem',
} as const;

export const FONT_FAMILIES = {
  /** Headings and the wordmark: Playfair Display (bundled, OFL, Latin only); Arabic text falls through to IBM Plex Sans Arabic. */
  display: "'Playfair Display', Georgia, 'IBM Plex Sans Arabic', serif",
  numeric: "'Poppins', sans-serif",
  latin: "'Poppins', 'IBM Plex Sans Arabic', sans-serif",
  arabic: "'IBM Plex Sans Arabic', 'Poppins', sans-serif",
} as const;

export const FONT_SIZES = {
  xxs: '0.53125rem',
  xs: '0.6875rem',
  sm: '0.75rem',
  nav: '0.78125rem',
  base: '0.8125rem',
  md: '0.9375rem',
  lg: '1.125rem',
  xl: '1.5rem',
  title: '1.5625rem',
  xxl: '2rem',
  hero: '2.25rem',
} as const;

export const FONT_WEIGHTS = { regular: '400', medium: '500', semibold: '600', bold: '700' } as const;
/** Letter spacing of the brand tagline and wordmark (design: 1.6–2px on small caps). */
export const TRACKING = { brand: '0.18em', mark: '0.02em', tight: '-0.0125em' } as const;
export const LINE_HEIGHT = '1.5';
export const LINE_HEIGHT_TIGHT = '1.25';

export const OPACITY = { disabled: '0.5', pressed: '0.85', brandText: '0.85' } as const;

export const MOTION = {
  fast: '0.15s',
  normal: '0.25s',
  pulse: '1.6s',
  easing: 'ease-out',
} as const;

export const Z_INDEX = { sidebar: '30', topbar: '20', overlay: '40', popover: '45', modal: '50', toast: '60', ribbon: '70' } as const;

export const SHADOWS = {
  light: {
    card: '0 1px 2px rgba(31,34,51,.04),0 6px 20px rgba(31,34,51,.035)',
    overlay: '0 12px 40px rgba(31,34,51,.18)',
    primary: '0 6px 16px rgba(109,40,217,.22)',
    nav: '0 6px 16px rgba(109,40,217,.25)',
    popup: '0 18px 50px rgba(20,23,43,.16)',
    brand: '0 10px 30px rgba(0,0,0,.25)',
  },
  dark: {
    card: 'none',
    overlay: '0 12px 40px rgba(0,0,0,.5)',
    primary: '0 6px 16px rgba(0,0,0,.35)',
    nav: '0 6px 16px rgba(0,0,0,.35)',
    popup: '0 18px 50px rgba(0,0,0,.5)',
    brand: '0 10px 30px rgba(0,0,0,.35)',
  },
} as const;

export const BREAKPOINTS = { medium: 640, expanded: 1024 } as const;
export const BREAKPOINT_CLASSES = ['compact', 'medium', 'expanded'] as const;
export type BreakpointClass = (typeof BREAKPOINT_CLASSES)[number];
export const ORIENTATIONS = ['portrait', 'landscape'] as const;
export type Orientation = (typeof ORIENTATIONS)[number];
