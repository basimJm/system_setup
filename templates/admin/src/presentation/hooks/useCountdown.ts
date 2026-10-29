import { useCallback, useEffect, useState } from 'react';

const TICK_MS = 1000;

export interface Countdown {
  remaining: number;
  restart: () => void;
}

/** Counts `seconds` down to 0 once per second from mount; `restart` begins again. Stops ticking at 0. */
export function useCountdown(seconds: number): Countdown {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) return undefined;
    const id = setTimeout(() => setRemaining((r) => Math.max(0, r - 1)), TICK_MS);
    return () => clearTimeout(id);
  }, [remaining]);

  const restart = useCallback(() => setRemaining(seconds), [seconds]);
  return { remaining, restart };
}

/** 75 -> "1:15", 5 -> "0:05". */
export function formatClock(totalSeconds: number): string {
  const SECONDS_PER_MINUTE = 60;
  const PAD = 2;
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return `${minutes}:${String(seconds).padStart(PAD, '0')}`;
}
