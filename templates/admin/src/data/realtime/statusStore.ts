import type { RealtimeStatus } from '@/domain/realtime/realtime';

/** Small observable for the connection status, shared by both client implementations. */
export function createStatusStore(initial: RealtimeStatus = 'idle') {
  let current = initial;
  const listeners = new Set<(s: RealtimeStatus) => void>();
  return {
    get: () => current,
    set(next: RealtimeStatus) {
      if (next === current) return;
      current = next;
      listeners.forEach((l) => l(next));
    },
    subscribe(listener: (s: RealtimeStatus) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
