import { useTranslation } from 'react-i18next';
import { useContainer } from '@/app/ContainerContext';

/**
 * Corner ribbon that marks a non-production build. `__SHOW_ENV_RIBBON__` is false in prod builds,
 * so the bundler removes this component's markup there instead of merely hiding it.
 */
export function EnvRibbon() {
  const { config } = useContainer();
  const { t } = useTranslation();
  if (!__SHOW_ENV_RIBBON__ || config.variant.appEnv !== 'dev') return null;
  return (
    <div className="app-env-ribbon" role="status">
      {t('env.devRibbon')}
    </div>
  );
}
