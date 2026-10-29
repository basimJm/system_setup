import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ACTIVITY_EVENTS,
  ACTIVITY_THROTTLE_MS,
  IDLE_TICK_MS,
  IDLE_WARNING_MS,
  SESSION_IDLE_MS,
} from '@/constants/session';
import { idleStatus, type IdleStatus } from '@/domain/auth/sessionRules';

export interface UseIdleTimeoutOptions {
  /** Called once when the idle time is used up. */
  onExpire: () => void;
  enabled?: boolean;
  idleMs?: number;
  warnMs?: number;
  now?: () => number;
}

const ACTIVE: IdleStatus = { state: 'active', secondsLeft: 0 };

/**
 * Counts the time since the last real input (click, key, wheel, touch). Near the end it reports `warning`
 * with a countdown; activity no longer resets it then, only `stay()` does. At the end it calls `onExpire`.
 */
export function useIdleTimeout({
  onExpire,
  enabled = true,
  idleMs = SESSION_IDLE_MS,
  warnMs = IDLE_WARNING_MS,
  now = Date.now,
}: UseIdleTimeoutOptions): { status: IdleStatus; stay: () => void } {
  const [status, setStatus] = useState<IdleStatus>(ACTIVE);
  const last = useRef(now());
  const fired = useRef(false);
  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  });

  const stay = useCallback(() => {
    last.current = now();
    fired.current = false;
    setStatus(ACTIVE);
  }, [now]);

  useEffect(() => {
    if (!enabled) return undefined;
    last.current = now();
    fired.current = false;
    const onActivity = () => {
      const t = now();
      const current = idleStatus(last.current, t, idleMs, warnMs);
      if (current.state === 'active' && t - last.current >= ACTIVITY_THROTTLE_MS) last.current = t;
    };
    for (const name of ACTIVITY_EVENTS)
      window.addEventListener(name, onActivity, { passive: true });
    const timer = setInterval(() => {
      const next = idleStatus(last.current, now(), idleMs, warnMs);
      setStatus((prev) =>
        prev.state === next.state && prev.secondsLeft === next.secondsLeft
          ? prev
          : next.state === 'active'
            ? ACTIVE
            : next,
      );
      if (next.state === 'expired' && !fired.current) {
        fired.current = true;
        expire.current();
      }
    }, IDLE_TICK_MS);
    return () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity);
      clearInterval(timer);
    };
  }, [enabled, idleMs, warnMs, now]);

  return { status, stay };
}
