import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useContainer } from '@/app/ContainerContext';
import type { RealtimeHandler, RealtimeStatus } from '@/domain/realtime/realtime';

/** Runs `handler` for every `event` the server pushes while the component is mounted. */
export function useRealtime(event: string, handler: RealtimeHandler): void {
  const { realtime } = useContainer();
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => realtime.on(event, (payload) => latest.current(payload)), [realtime, event]);
}

export function useRealtimeStatus(): RealtimeStatus {
  const { realtime } = useContainer();
  return useSyncExternalStore(
    (listener) => realtime.onStatus(listener),
    () => realtime.status(),
  );
}

/** Keeps the connection open while an admin is signed in; the token is read again on every reconnect. */
export function useRealtimeConnection(signedIn: boolean): void {
  const { realtime, session } = useContainer();
  useEffect(() => {
    if (!signedIn) return undefined;
    realtime.connect(() => session.get()?.accessToken ?? null);
    return () => realtime.disconnect();
  }, [realtime, session, signedIn]);
}
