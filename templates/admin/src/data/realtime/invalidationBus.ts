import type { QueryClient } from '@tanstack/react-query';
import { REALTIME_EVENTS, REALTIME_INVALIDATIONS } from '@/constants/realtime';
import type { RealtimeClient } from '@/domain/realtime/realtime';

/**
 * Turns server events into cache invalidations: a screen that shows items refetches on `item.updated`
 * without knowing about sockets. Returns the function that stops listening.
 */
export function startInvalidationBus(client: RealtimeClient, queryClient: QueryClient): () => void {
  const offs = REALTIME_EVENTS.map((event) =>
    client.on(event, () => {
      for (const queryKey of REALTIME_INVALIDATIONS[event])
        void queryClient.invalidateQueries({ queryKey });
    }),
  );
  return () => offs.forEach((off) => off());
}
