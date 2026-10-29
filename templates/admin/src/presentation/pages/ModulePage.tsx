import { useTranslation } from 'react-i18next';
import { NAV_PAGES } from '@/constants/nav';
import { PageHeader } from '../components/core/PageHeader';
import { EmptyState } from '../components/feedback/EmptyState';

/** Placeholder for a module whose feature task (ADM-02…05) has not landed yet. */
export function ModulePage({ path }: { path: string }) {
  const { t } = useTranslation();
  const item = NAV_PAGES.find((n) => n.path === path);
  return (
    <>
      <PageHeader title={item ? t(item.labelKey) : t('app.name')} />
      <EmptyState
        title={t('module.comingSoon')}
        description={t('module.comingSoonText')}
        icon={item?.icon ?? 'inbox'}
      />
    </>
  );
}
