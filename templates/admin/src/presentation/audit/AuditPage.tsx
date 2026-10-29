import { Badge } from '../components/core/Badge';
import { Icon } from '../components/core/Icon';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useContainer } from '@/app/ContainerContext';
import { hasDiff, humanizeAction, type AuditLog, type AuditQuery } from '@/domain/audit/audit';
import { formatInstant } from '@/domain/shared/format';
import { KeyValue } from '../components/core/KeyValue';
import type { Column } from '../components/data/tableTypes';
import { SearchField } from '../components/form/SearchField';
import { TextField } from '../components/form/TextField';
import { Drawer } from '../components/overlay/Drawer';
import { JsonViewer } from '../components/templates/JsonViewer';
import { ListPage } from '../components/templates/ListPage';
import { useListController } from '../controllers/useListController';
import { useLanguage } from '../hooks/useLanguage';

const OPTIONS = { filterKeys: ['action', 'entityType', 'entityId', 'admin'] };

function queryOf(
  filters: Readonly<Record<string, readonly string[]>>,
  page: number,
  pageSize: number,
): AuditQuery {
  const f = (k: string) => filters[k]?.[0];
  return {
    page,
    pageSize,
    ...(f('action') ? { action: f('action') } : {}),
    ...(f('entityType') ? { entityType: f('entityType') } : {}),
    ...(f('entityId') ? { entityId: f('entityId') } : {}),
    ...(f('admin') ? { adminId: f('admin') } : {}),
  };
}

function Details({ log }: { log: AuditLog }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  return (
    <div className="app-stack">
      <KeyValue
        placeholder="—"
        items={[
          { key: 'action', label: t('audit.action'), value: humanizeAction(log.action) },
          {
            key: 'entity',
            label: t('audit.entity'),
            value: `${log.entityType} · ${log.entityId}`,
            ltr: true,
          },
          { key: 'reason', label: t('reason.label'), value: log.reason },
          {
            key: 'at',
            label: t('common.at'),
            value: formatInstant(log.createdAt, language, 'dateTime'),
            ltr: true,
          },
          { key: 'admin', label: t('audit.admin'), value: log.adminId, ltr: true },
          { key: 'ip', label: t('audit.ip'), value: log.ip, ltr: true },
          { key: 'ua', label: t('audit.device'), value: log.userAgent, ltr: true },
        ]}
      />
      {hasDiff(log) ? (
        <div className="app-row">
          <JsonViewer value={log.before ?? null} label={t('audit.before')} />
          <JsonViewer value={log.after ?? null} label={t('audit.after')} />
        </div>
      ) : (
        <p>{t('audit.noDiff')}</p>
      )}
    </div>
  );
}

/** Admin PRD A29 · Audit log: every admin action with who, what, why and from where; open one for the before/after diff. */
export default function AuditPage() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { repositories } = useContainer();
  const list = useListController(OPTIONS);
  const { state } = list;
  const f = (k: string) => state.filters[k]?.[0] ?? '';
  const [open, setOpen] = useState<AuditLog | null>(null);
  const query = useQuery({
    queryKey: ['getAuditLogs', state],
    queryFn: () => repositories.audit.list(queryOf(state.filters, state.page, state.pageSize)),
  });
  const title = t('nav.auditLog');
  const columns: Column<AuditLog>[] = [
    {
      key: 'at',
      header: t('common.at'),
      ltr: true,
      render: (r) => formatInstant(r.createdAt, language, 'dateTime'),
    },
    {
      key: 'action',
      header: t('audit.action'),
      render: (r) => (
        <span className="app-cell2">
          <span className="app-cell2__main">{humanizeAction(r.action)}</span>
          <bdi className="app-cell2__code">{r.action}</bdi>
        </span>
      ),
    },
    {
      key: 'entity',
      header: t('audit.entity'),
      ltr: true,
      render: (r) => `${r.entityType} · ${r.entityId.slice(-6)}`,
    },
    { key: 'reason', header: t('reason.label'), render: (r) => r.reason },
    { key: 'ip', header: t('audit.ip'), ltr: true, render: (r) => r.ip },
    {
      key: 'device',
      header: t('audit.device'),
      ltr: true,
      render: (r) => (
        <span className="app-cell-clip" title={r.userAgent}>
          {r.userAgent}
        </span>
      ),
    },
  ];
  const chip = (key: string, label: string) =>
    f(key) ? [{ key, label: `${label}: ${f(key)}`, onRemove: () => list.setFilter(key, []) }] : [];
  const text = (key: string, label: string) => (
    <TextField
      label={label}
      dir="ltr"
      value={f(key)}
      onChange={(e) => list.setFilter(key, e.target.value ? [e.target.value] : [])}
    />
  );
  const data = query.data;
  return (
    <>
      <ListPage
        title={title}
        badges={
          <Badge tone="grey">
            <Icon name="lock" size="sm" />
            {t('audit.readOnly')}
          </Badge>
        }
        subtitle={t('audit.subtitle')}
        search={
          <SearchField
            label={t('audit.searchAction')}
            initialValue={f('action')}
            onSearch={(v) => list.setFilter('action', v ? [v] : [])}
          />
        }
        filters={{
          active: [
            ...chip('action', t('audit.action')),
            ...chip('entityType', t('audit.entityType')),
            ...chip('entityId', t('audit.entityId')),
            ...chip('admin', t('audit.admin')),
          ],
          onClearAll: list.clearFilters,
          controls: (
            <>
              {text('entityType', t('audit.entityType'))}
              {text('entityId', t('audit.entityId'))}
              {text('admin', t('audit.admin'))}
            </>
          ),
        }}
        table={{
          columns,
          rows: data?.items ?? [],
          rowKey: (r) => r.id,
          caption: title,
          loading: query.isPending,
          error: query.error,
          onRetry: () => void query.refetch(),
          emptyTitle: t('audit.empty'),
          onRowClick: setOpen,
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
      <Drawer
        open={open !== null}
        title={open ? humanizeAction(open.action) : ''}
        onClose={() => setOpen(null)}
      >
        {open ? <Details log={open} /> : null}
      </Drawer>
    </>
  );
}
