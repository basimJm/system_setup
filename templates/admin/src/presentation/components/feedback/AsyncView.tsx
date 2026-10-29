import type { ReactNode } from 'react';
import { ErrorState } from './ErrorState';

export interface AsyncViewProps {
  loading: boolean;
  error: unknown;
  onRetry?: () => void;
  skeleton: ReactNode;
  children: ReactNode;
}

/** One place that decides loading / error / content, so every page has all three states. */
export function AsyncView({ loading, error, onRetry, skeleton, children }: AsyncViewProps) {
  if (error !== undefined && error !== null)
    return <ErrorState error={error} {...(onRetry ? { onRetry } : {})} />;
  return <>{loading ? skeleton : children}</>;
}
