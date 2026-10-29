import { useEffect } from 'react';
import { useContainer } from '@/app/ContainerContext';
import { MAX_TIMER_DELAY_MS, REFRESH_SKEW_MS } from '@/constants/session';
import type { Session } from '@/domain/auth/auth';
import { refreshDelay } from '@/domain/auth/sessionRules';

/**
 * Refreshes the access token shortly before it expires, without waiting for the next request, so an open
 * panel (and its realtime socket) keeps a valid token for the whole 2-day session. A tab coming back to the
 * foreground checks at once (timers are throttled in background tabs). The idle sign-out still ends it.
 */
export function useProactiveRefresh(session: Session | null, now: () => number = Date.now): void {
  const { sessionManager } = useContainer();
  useEffect(() => {
    if (!session) return undefined;
    const delay = refreshDelay(session, now(), REFRESH_SKEW_MS, MAX_TIMER_DELAY_MS);
    const timer =
      delay === null ? undefined : setTimeout(() => void sessionManager.ensureFresh(), delay);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void sessionManager.ensureFresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [session, sessionManager, now]);
}
