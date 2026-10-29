import { createContext, useContext } from 'react';
import type { Container } from './container';

export const ContainerContext = createContext<Container | null>(null);

export function useContainer(): Container {
  const container = useContext(ContainerContext);
  if (!container) throw new Error('useContainer must be used inside AppProviders');
  return container;
}
