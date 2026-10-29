import { useSyncExternalStore } from 'react';
import { useContainer } from '@/app/ContainerContext';
import type { Session } from '@/domain/auth/auth';

export function useSession(): Session | null {
  const { session } = useContainer();
  return useSyncExternalStore(session.subscribe, session.get, session.get);
}
