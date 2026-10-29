export const STORAGE_PREFIX = 'admin.';

export const STORAGE_KEYS = {
  language: `${STORAGE_PREFIX}language`,
  theme: `${STORAGE_PREFIX}theme`,
  sidebarCollapsed: `${STORAGE_PREFIX}sidebarCollapsed`,
  chunkReloadAt: `${STORAGE_PREFIX}chunkReloadAt`,
  /** The signed-in session, in this tab's sessionStorage only (survives a reload, gone when the tab closes). */
  session: `${STORAGE_PREFIX}session`,
} as const;
