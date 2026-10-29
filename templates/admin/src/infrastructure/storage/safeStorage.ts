/** localStorage that never throws (private windows, blocked storage, quota). Only for UI conveniences. */
const resolve = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const safeStorage = {
  get(key: string): string | null {
    try {
      return resolve()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      resolve()?.setItem(key, value);
    } catch {
      /* storage unavailable: the preference simply does not persist */
    }
  },
  remove(key: string): void {
    try {
      resolve()?.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
