import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useContainer } from '@/app/ContainerContext';
import { ROUTES } from '@/constants/routes';
import { ITEM_STATUSES, transitionOf, type Item } from '@/domain/items/items';
import { formatInstant } from '@/domain/shared/format';
import { ITEMS_STRINGS } from '@/locales/lazy/items';
import { Button } from '../components/core/Button';
import { StatusBadge } from '../components/core/StatusBadge';
import type { Column } from '../components/data/tableTypes';
import { SearchField } from '../components/form/SearchField';
import { Select } from '../components/form/Select';
import { ListPage } from '../components/templates/ListPage';
import { useListController } from '../controllers/useListController';
import { useLanguage } from '../hooks/useLanguage';
import { useLazyStrings } from '../hooks/useLazyStrings';
import { ITEM_FILTER_KEYS, itemQueryOf } from './itemFilters';
import { useItemTransition } from './useItemTransition';

const OPTIONS = { filterKeys: ITEM_FILTER_KEYS };

/** PRD P01 · Items: searchable, filterable list of user-owned records; archive / restore with a reason. */
export default function ItemsPage() {
  useLazyStrings(ITEMS_STRINGS);
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { repositories } = useContainer();
  const list = useListController(OPTIONS);
  const { state } = list;
  const query = itemQueryOf(state);
  const result = useQuery({
    queryKey: ['getItems', query],
    queryFn: () => repositories.items.list(query),
  });
  const transition = useItemTransition();
  const data = result.data;
  const title = t('nav.items');
  const status = query.status;
  const columns: Column<Item>[] = [
    {
      key: 'title',
      header: t('items.title'),
      render: (r) => <RouterLink to={`${ROUTES.items}/${r.id}`}>{r.title}</RouterLink>,
    },
    {
      key: 'owner',
      header: t('items.owner'),
      render: (r) => <StatusBadge kind="itemOwner" value={r.owner.type} />,
    },
    { key: 'tags', header: t('items.tags'), render: (r) => r.tags.join(', ') },
    {
      key: 'status',
      header: t('common.status'),
      render: (r) => <StatusBadge kind="item" value={r.status} />,
    },
    {
      key: 'updatedAt',
      header: t('items.updatedAt'),
      ltr: true,
      render: (r) => formatInstant(r.updatedAt, language, 'dateTime'),
    },
  ];
  return (
    <>
      <ListPage
        title={title}
        subtitle={t('items.subtitle')}
        search={
          <SearchField
            label={t('items.search')}
            initialValue={state.search}
            onSearch={list.setSearch}
          />
        }
        filters={{
          active: status
            ? [
                {
                  key: 'status',
                  label: `${t('common.status')}: ${t(`status.item.${status}`)}`,
                  onRemove: () => list.setFilter('status', []),
                },
              ]
            : [],
          onClearAll: list.clearFilters,
          controls: (
            <Select
              label={t('common.status')}
              value={status ?? ''}
              options={[
                { value: '', label: t('common.all') },
                ...ITEM_STATUSES.map((s) => ({ value: s, label: t(`status.item.${s}`) })),
              ]}
              onChange={(e) => list.setFilter('status', e.target.value ? [e.target.value] : [])}
            />
          ),
        }}
        table={{
          columns,
          rows: data?.items ?? [],
          rowKey: (r) => r.id,
          caption: title,
          loading: result.isPending,
          error: result.error,
          onRetry: () => void result.refetch(),
          emptyTitle: t('items.empty'),
          rowActions: (r) => (
            <Button variant="ghost" size="sm" onClick={() => transition.open(r)}>
              {t(`items.${transitionOf(r)}`)}
            </Button>
          ),
        }}
        pagination={
          data
            ? {
                page: state.page,
                pageSize: state.pageSize,
                total: data.meta.total,
                onPageChange: list.setPage,
                onPageSizeChange: list.setPageSize,
                ariaLabel: title,
              }
            : undefined
        }
      />
      {transition.dialog}
    </>
  );
}
