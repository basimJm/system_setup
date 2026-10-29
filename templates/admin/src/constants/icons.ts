/**
 * SVG path data (24x24 viewBox, stroke icons), copied from the design kit (`design/app-admin-kit.js` `W.IC`).
 * One place so icons are never inlined in components.
 */
export const ICON_PATHS = {
  pulse: 'M3 12h4l3-8 4 16 3-8h4',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  route:
    'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9a4 4 0 0 1 4-4h6M18 9v6a4 4 0 0 1-4 4H8',
  users:
    'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.6a3.5 3.5 0 0 1 0 6.8',
  store:
    'M4 9.5 5.5 4h13L20 9.5M4 9.5V20h16V9.5M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M10 20v-5h4v5',
  calendar:
    'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8.5 3v4M15.5 3v4',
  wallet:
    'M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3M4 7.5v10A1.5 1.5 0 0 0 5.5 19H20V8H6.5A2.5 2.5 0 0 1 4 5.5M16.5 13.5h.01',
  star: 'm12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  image: 'M4 5h16v14H4zM4 15l4.5-4.5 4 4 2.5-2.5L20 17M15.5 9.5h.01',
  send: 'M21 3 10 14M21 3l-6.5 18-3.5-7-7-3.5z',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7.3 7.3 0 0 1-2.1 1.2l-.3 2h-4l-.3-2a7.3 7.3 0 0 1-2.1-1.2l-1.9.7-2-3.4 1.6-1.2a7.4 7.4 0 0 1 0-3l-1.6-1.2 2-3.4 1.9.7a7.3 7.3 0 0 1 2.1-1.2l.3-2h4l.3 2a7.3 7.3 0 0 1 2.1 1.2l1.9-.7 2 3.4-1.6 1.2a7.4 7.4 0 0 1 0 3z',
  shield: 'M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6zM9 12l2 2 4-4',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
  chevronDown: 'M6 9l6 6 6-6',
  chevronStart: 'M15 6l-6 6 6 6',
  chevronEnd: 'M9 6l6 6-6 6',
  /** Sidebar "collapse" (arrow towards a bar); mirrored in RTL. */
  collapse: 'M15 5l-7 7 7 7M20 5v14',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  globe:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20a7 7 0 0 1 14 0',
  check: 'M5 12.5l4.5 4.5L19 7',
  alert: 'M12 4 2.5 20h19zM12 10v4.5M12 17.5h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  inbox: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5',
  sortUp: 'M12 19V5M5 12l7-7 7 7',
  sortDown: 'M12 5v14M5 12l7 7 7-7',
  monitor: 'M3 4h18v12H3zM8 20h8M12 16v4',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff:
    'M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.7 8.4 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  mail: 'M3 6h18v12H3zM3 6l9 7 9-7',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  download: 'M12 4v12M6 11l6 6 6-6M5 20h14',
  plus: 'M12 5v14M5 12h14',
  filter: 'M4 5h16l-6 8v6l-4-2v-4z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L12 6.3M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
} as const;

export type IconName = keyof typeof ICON_PATHS;
/** Stroke width of every icon (design kit: 1.8 on a 24 grid). */
export const ICON_STROKE_WIDTH = '1.8';
