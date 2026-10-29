import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useContainer } from '@/app/ContainerContext';
import { ROUTES } from '@/constants/routes';
import { ITEM_ENTITY_TYPE, transitionOf, type Item } from '@/domain/items/items';
import { humanizeAction, type AuditLog } from '@/domain/audit/audit';
import { formatInstant } from '@/domain/shared/format';
import { ITEMS_STRINGS } from '@/locales/lazy/items';
import { Button } from '../components/core/Button';
import { KeyValue } from '../components/core/KeyValue';
import { StatusBadge } from '../components/core/StatusBadge';
import { DataTable } from '../components/data/DataTable';
import type { Column } from '../components/data/tableTypes';
import { DetailPage } from '../components/templates/DetailPage';
import { useLanguage } from '../hooks/useLanguage';
import { useLazyStrings } from '../hooks/useLazyStrings';
import { useItemTransition } from './useItemTransition';

const HISTORY_PAGE_SIZE = 25;

function Overview({ item }: { item: Item }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const at = (iso: string | null) => (iso ? formatInstant(iso, language, 'dateTime') : null);
  return (
    <KeyValue
      placeholder={t('common.none')}
      items={[
        { key: 'title', label: t('items.title'), value: item.title },
        { key: 'description', label: t('items.description'), value: item.description },
        { key: 'tags', label: t('items.tags'), value: item.tags.join(', ') || null },
        {
          key: 'owner',
          label: t('items.owner'),
          value: `${t(`status.itemOwner.${item.owner.type}`)} · ${item.owner.id}`,
          ltr: true,
        },
        {
          key: 'image',
          label: t('items.image'),
          value: item.imageUrl ?? t('items.noImage'),
          ltr: true,
        },
        { key: 'archivedReason', label: t('items.archivedReason'), value: item.archivedReason },
        { key: 'archivedAt', label: t('items.archivedAt'), value: at(item.archivedAt), ltr: true },
        { key: 'created', label: t('items.createdAt'), value: at(item.createdAt), ltr: true },
        { key: 'updated', label: t('items.updatedAt'), value: at(item.updatedAt), ltr: true },
        { key: 'id', label: t('items.id'), value: item.id, ltr: true },
      ]}
    />
  );
}

/** Every audited admin change of this record, read from the audit log by entity. */
function History({ id }: { id: string }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { repositories } = useContainer();
  const query = useQuery({
    queryKey: ['getAuditLogs', { entityType: ITEM_ENTITY_TYPE, entityId: id }],
    queryFn: () =>
      repositories.audit.list({
        page: 1,
        pageSize: HISTORY_PAGE_SIZE,
        entityType: ITEM_ENTITY_TYPE,
        entityId: id,
      }),
  });
  const columns: Column<AuditLog>[] = [
    {
      key: 'at',
      header: t('common.at'),
      ltr: true,
      render: (r) => formatInstant(r.createdAt, language, 'dateTime'),
    },
    { key: 'action', header: t('items.action'), render: (r) => humanizeAction(r.action) },
    { key: 'reason', header: t('reason.label'), render: (r) => r.reason },
  ];
  return (
    <DataTable
      caption={t('items.history')}
      columns={columns}
      rows={query.data?.items ?? []}
      rowKey={(r) => r.id}
      loading={query.isPending}
      error={query.error}
      onRetry={() => void query.refetch()}
      emptyTitle={t('items.noHistory')}
    />
  );
}

/** PRD P02 · One item: facts, audit history, and archive / restore with a reason. */
export default function ItemDetailsPage() {
  useLazyStrings(ITEMS_STRINGS);
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const { repositories } = useContainer();
  const [tab, setTab] = useState('overview');
  const query = useQuery({
    queryKey: ['getItemsById', { id }],
    queryFn: () => repositories.items.get(id),
  });
  const transition = useItemTransition();
  const item = query.data;
  return (
    <>
      <DetailPage
        title={item?.title ?? t('nav.items')}
        back={{ to: ROUTES.items, label: t('nav.items') }}
        status={item ? <StatusBadge kind="item" value={item.status} /> : null}
        actions={
          item ? (
            <Button
              variant={item.status === 'ACTIVE' ? 'danger' : 'primary'}
              onClick={() => transition.open(item)}
            >
              {t(`items.${transitionOf(item)}`)}
            </Button>
          ) : null
        }
        tabs={[
          {
            id: 'overview',
            label: t('items.overview'),
            content: item ? <Overview item={item} /> : null,
          },
          { id: 'history', label: t('items.history'), content: <History id={id} /> },
        ]}
        activeTab={tab}
        onTabChange={setTab}
        tabsLabel={t('items.sections')}
        loading={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
      {transition.dialog}
    </>
  );
}
