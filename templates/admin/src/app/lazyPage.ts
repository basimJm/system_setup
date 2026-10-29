import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { STORAGE_KEYS } from '@/constants/storage';
import { safeStorage } from '@/infrastructure/storage/safeStorage';

/** A deploy replaces the hashed files an open tab still points at; the browser then fails to load the page's code. */
const CHUNK_ERROR = /dynamically imported module|importing a module script failed|loading chunk/i;
/** A second failure within this time is a real problem (not a new deploy): it is shown instead of reloading again. */
export const CHUNK_RELOAD_WINDOW_MS = 10_000;

export const isChunkLoadError = (error: unknown): boolean =>
  error instanceof Error && CHUNK_ERROR.test(error.message);

export interface LazyPageOptions {
  reload?: () => void;
  now?: () => number;
}

/**
 * `lazy()` for route pages. When the page's code cannot be fetched (a new version was deployed while the tab was open)
 * the page is reloaded once to pick up the new files; the panel signs the admin out on a reload, which is the price of
 * never showing a broken screen. A repeated failure is thrown to the route's error page.
 */
export function lazyPage<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>,
  { reload = () => window.location.reload(), now = () => Date.now() }: LazyPageOptions = {},
): LazyExoticComponent<ComponentType<P>> {
  return lazy(async () => {
    try {
      const page = await load();
      safeStorage.remove(STORAGE_KEYS.chunkReloadAt);
      return page;
    } catch (error) {
      const last = Number(safeStorage.get(STORAGE_KEYS.chunkReloadAt) ?? 0);
      if (!isChunkLoadError(error) || now() - last < CHUNK_RELOAD_WINDOW_MS) throw error;
      safeStorage.set(STORAGE_KEYS.chunkReloadAt, String(now()));
      reload();
      // The page is going away: keep the router waiting instead of flashing an error.
      return new Promise<never>(() => undefined);
    }
  });
}
