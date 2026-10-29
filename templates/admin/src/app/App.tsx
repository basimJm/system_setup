import { Suspense, useMemo } from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { EnvRibbon } from '@/presentation/layout/EnvRibbon';
import { ScenarioSwitcher } from '@/presentation/layout/ScenarioSwitcher';
import { Spinner } from '@/presentation/components/feedback/Spinner';
import { useViewport } from '@/presentation/hooks/useViewport';
import { useContainer } from './ContainerContext';
import { buildRoutes } from './routes';

export function App() {
  const { config } = useContainer();
  // Publishes data-bp / data-orientation on <html> for every screen, including login.
  useViewport();
  const router = useMemo(
    () => createBrowserRouter(buildRoutes(config.variant.appEnv === 'dev')),
    [config],
  );
  return (
    <Suspense fallback={<Spinner />}>
      <RouterProvider router={router} />
      <EnvRibbon />
      <ScenarioSwitcher />
    </Suspense>
  );
}
