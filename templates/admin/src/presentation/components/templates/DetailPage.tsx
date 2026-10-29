import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '../core/Link';
import { PageHeader } from '../core/PageHeader';
import { AsyncView } from '../feedback/AsyncView';
import { Skeleton } from '../feedback/Skeleton';
import { Tabs, type TabItem } from '../data/Tabs';

export interface DetailPageProps {
  title: string;
  subtitle?: string;
  /** Status badge(s) shown next to the title. */
  status?: ReactNode;
  /** Header buttons (approve, block...). */
  actions?: ReactNode;
  /** Link back to the list this record came from. */
  back?: { to: string; label: string };
  tabs: readonly TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  tabsLabel: string;
  /** Side panel: key facts, related links, "last updated". */
  aside?: ReactNode;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
}

/** Every record screen: back link, header with status and actions, tabs for the body, side info panel. */
export function DetailPage({
  title,
  subtitle,
  status,
  actions,
  back,
  tabs,
  activeTab,
  onTabChange,
  tabsLabel,
  aside,
  loading = false,
  error,
  onRetry,
}: DetailPageProps) {
  const { t } = useTranslation();
  return (
    <div className="app-page app-stack">
      {back ? <Link to={back.to}>{t('detail.backTo', { list: back.label })}</Link> : null}
      <PageHeader
        title={title}
        {...(subtitle ? { subtitle } : {})}
        actions={
          <>
            {status}
            {actions}
          </>
        }
      />
      <AsyncView
        loading={loading}
        error={error}
        {...(onRetry ? { onRetry } : {})}
        skeleton={<Skeleton width="full" />}
      >
        <div className="app-detail">
          <Tabs items={tabs} activeId={activeTab} onChange={onTabChange} ariaLabel={tabsLabel} />
          {aside ? <aside className="app-detail__aside">{aside}</aside> : null}
        </div>
      </AsyncView>
    </div>
  );
}
