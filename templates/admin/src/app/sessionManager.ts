import { REFRESH_SKEW_MS, type SessionEndReason } from '@/constants/session';
import type { AuthRepository } from '@/domain/auth/auth';
import { canRefresh, isExpiringSoon } from '@/domain/auth/sessionRules';
import type { Logger } from '@/infrastructure/logger/logger';
import type { SessionStore } from './session';

export interface SessionManager {
  /** Refreshes the access token when it is about to expire. Never throws: a failure ends the session. */
  ensureFresh: () => Promise<void>;
  /** One refresh at a time: every caller shares the same request. True when the session continues. */
  refresh: () => Promise<boolean>;
  /** Revokes the refresh token on the server (best effort) and clears the session. */
  signOut: (reason?: SessionEndReason) => Promise<void>;
}

export interface SessionManagerDeps {
  store: SessionStore;
  auth: () => AuthRepository;
  logger: Logger;
  now?: () => number;
  skewMs?: number;
}

export function createSessionManager({
  store,
  auth,
  logger,
  now = Date.now,
  skewMs = REFRESH_SKEW_MS,
}: SessionManagerDeps): SessionManager {
  let inFlight: Promise<boolean> | null = null;

  const refresh = (): Promise<boolean> => {
    if (inFlight) return inFlight;
    const current = store.get();
    if (!current || !canRefresh(current, now())) return Promise.resolve(false);
    const used = current.refreshToken ?? '';
    inFlight = auth()
      .refresh(used)
      .then(
        (next) => {
          // The admin may have signed out while the request ran: never bring a revoked session back.
          if (store.get()?.refreshToken !== used) return false;
          store.set(next);
          return true;
        },
        (error: unknown) => {
          logger.warn('session.refresh_failed', { message: String(error) });
          store.clear('expired');
          return false;
        },
      )
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };

  return {
    refresh,
    async ensureFresh() {
      const current = store.get();
      if (current && isExpiringSoon(current, now(), skewMs) && canRefresh(current, now()))
        await refresh();
    },
    async signOut(reason) {
      const token = store.get()?.refreshToken;
      store.clear(reason);
      if (!token) return;
      await auth()
        .logout(token)
        .catch((error: unknown) => logger.warn('logout.failed', { message: String(error) }));
    },
  };
}
