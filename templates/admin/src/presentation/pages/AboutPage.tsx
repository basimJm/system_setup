import { useTranslation } from 'react-i18next';
import { useContainer } from '@/app/ContainerContext';
import { Badge } from '../components/core/Badge';
import { Card } from '../components/core/Card';
import { PageHeader } from '../components/core/PageHeader';

/** Build information for support and QA. Public, non-secret values only (never URLs with credentials). */
export default function AboutPage() {
  const { config } = useContainer();
  const { t } = useTranslation();
  const rows: ReadonlyArray<readonly [string, string]> = [
    [t('about.version'), config.build.version],
    [t('about.buildId'), config.build.buildId],
    [t('about.environment'), t(`about.env.${config.variant.appEnv}`)],
    [t('about.variant'), config.variant.name],
    [t('about.dataSource'), t(`about.source.${config.dataSource}`)],
    [t('about.language'), t(`about.languageName.${config.defaultLanguage}`)],
  ];
  return (
    <>
      <PageHeader
        title={t('about.title')}
        subtitle={t('about.subtitle')}
        actions={
          <Badge tone={config.variant.appEnv === 'prod' ? 'green' : 'amber'}>
            {t(`about.env.${config.variant.appEnv}`)}
          </Badge>
        }
      />
      <Card>
        <dl className="app-about">
          {rows.map(([label, value]) => (
            <div key={label} className="app-about__row">
              <dt className="app-about__label">{label}</dt>
              <dd className="app-about__value" dir="ltr">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  );
}
