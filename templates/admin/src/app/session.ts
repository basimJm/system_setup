import { z } from 'zod';
import type { SessionEndReason } from '@/constants/session';
import type { Session } from '@/domain/auth/auth';
import { canRefresh } from '@/domain/auth/sessionRules';
import type { KeyValueStorage } from '@/infrastructure/storage/tabStorage';

type Listener = () => void;

/** The session in memory, mirrored to the tab's sessionStorage so a reload keeps the admin signed in. */
export interface SessionStore {
  get: () => Session | null;
  set: (session: Session) => void;
  /** Ends the session; `reason` explains an end the admin did not ask for (shown on the login page). */
  clear: (reason?: SessionEndReason) => void;
  /** Why the last session ended, until the next sign-in. */
  endReason: () => SessionEndReason | null;
  subscribe: (listener: Listener) => () => void;
}

export interface SessionPersistence {
  storage: KeyValueStorage;
  key: string;
  now?: () => number;
}

const storedSessionSchema = z.object({
  accessToken: z.string().min(1),
  admin: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  accessExpiresAt: z.number().optional(),
  refreshToken: z.string().min(1),
  refreshExpiresAt: z.number().optional(),
});

/** Reads a stored session; anything malformed, without a refresh token or past its refresh expiry is dropped. */
export function restoreSession({
  storage,
  key,
  now = Date.now,
}: SessionPersistence): Session | null {
  const raw = storage.get(key);
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const result = storedSessionSchema.safeParse(parsed);
  if (result.success && canRefresh(result.data, now())) return result.data;
  storage.remove(key);
  return null;
}

export function createSessionStore(persistence?: SessionPersistence): SessionStore {
  let current: Session | null = persistence ? restoreSession(persistence) : null;
  let ended: SessionEndReason | null = null;
  const listeners = new Set<Listener>();
  const emit = () => listeners.forEach((l) => l());
  return {
    get: () => current,
    set(session) {
      current = session;
      ended = null;
      persistence?.storage.set(persistence.key, JSON.stringify(session));
      emit();
    },
    clear(reason) {
      persistence?.storage.remove(persistence.key);
      if (current === null) return;
      current = null;
      ended = reason ?? null;
      emit();
    },
    endReason: () => ended,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
