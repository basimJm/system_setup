/**
 * sessionStorage that never throws (private windows, blocked storage, quota). It belongs to one browser tab:
 * it survives a reload of that tab and is gone when the tab closes. Used for the signed-in session only.
 */
const resolve = (): Storage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const tabStorage: KeyValueStorage = {
  get(key) {
    try {
      return resolve()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      resolve()?.setItem(key, value);
    } catch {
      /* storage unavailable: the session then lasts until the next reload */
    }
  },
  remove(key) {
    try {
      resolve()?.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
