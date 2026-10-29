import { useRouteError } from 'react-router-dom';
import { ErrorState } from '../components/feedback/ErrorState';

/** Shown instead of the router's default crash screen when a page cannot load or throws while rendering. */
export function RouteErrorPage() {
  const error = useRouteError();
  return (
    <main className="app-content">
      <ErrorState error={error} onRetry={() => window.location.reload()} />
    </main>
  );
}
