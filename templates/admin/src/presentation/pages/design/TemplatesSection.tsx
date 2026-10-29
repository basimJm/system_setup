import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GALLERY_SAMPLE_REF } from '@/constants/ui';
import { Button } from '../../components/core/Button';
import { Card } from '../../components/core/Card';
import { Heading } from '../../components/core/Heading';
import { KeyValue } from '../../components/core/KeyValue';
import { SectionCard } from '../../components/core/SectionCard';
import { CardGrid } from '../../components/data/CardGrid';
import { StatusBadge } from '../../components/core/StatusBadge';
import type { Column } from '../../components/data/DataTable';
import { ListPage } from '../../components/templates/ListPage';
import { DetailPage } from '../../components/templates/DetailPage';
import { JsonViewer } from '../../components/templates/JsonViewer';
import { Timeline, type TimelineEntry } from '../../components/templates/Timeline';

interface ItemRow {
  id: string;
  owner: string;
  status: string;
}
const ITEMS: readonly ItemRow[] = [
  { id: 'ITEM-7K2M9Q', owner: 'a', status: 'ACTIVE' },
  { id: 'ITEM-3F8H1X', owner: 'b', status: 'INACTIVE' },
  { id: 'ITEM-9D4T6B', owner: 'c', status: 'ARCHIVED' },
];
const AUDIT_PAYLOAD = {
  action: 'ITEM_ARCHIVE',
  before: { status: 'ACTIVE', archiveReason: null },
  after: { status: 'ARCHIVED', archiveReason: 'inactive', tags: ['a', 'b'] },
};
const HISTORY: readonly Omit<TimelineEntry, 'title' | 'actor' | 'reason'>[] = [
  { id: 'h3', at: '2026-10-12T13:05:00Z', tone: 'rose' },
  { id: 'h2', at: '2026-10-12T09:40:00Z', tone: 'green' },
  { id: 'h1', at: '2026-10-11T18:20:00Z', tone: 'amber' },
];

/** Gallery section for the page templates (ADM-018): list page, section card + card grid, detail page, timeline, JSON viewer. */
export function TemplatesSection() {
  const { t } = useTranslation();
  const k = (key: string) => t(`designKits.templates.${key}`);
  const [tab, setTab] = useState('overview');
  const [page, setPage] = useState(1);
  const columns: readonly Column<ItemRow>[] = [
    { key: 'id', header: k('colRef'), render: (r) => r.id, ltr: true },
    { key: 'owner', header: k('colOwner'), render: (r) => k(`owner.${r.owner}`) },
    { key: 'status', header: k('colStatus'), render: (r) => <StatusBadge kind="item" value={r.status} /> },
  ];
  const entries: TimelineEntry[] = HISTORY.map((h) => ({
    ...h,
    title: k(`history.${h.id}.title`),
    actor: k(`history.${h.id}.actor`),
    ...(h.id === 'h3' ? { reason: k('history.h3.reason') } : {}),
  }));
  return (
    <Card className="app-stack" aria-label={k('title')}>
      <Heading level={2}>{k('title')}</Heading>
      <ListPage
        title={k('listTitle')}
        subtitle={k('listSubtitle')}
        actions={<Button>{k('create')}</Button>}
        table={{
          caption: k('listTitle'),
          columns,
          rows: ITEMS,
          rowKey: (r) => r.id,
        }}
        pagination={{
          page,
          pageSize: 10,
          total: 23,
          onPageChange: setPage,
          onPageSizeChange: () => undefined,
          ariaLabel: k('pagination'),
        }}
      />
      <SectionCard title={k('tabOverview')} subtitle={k('listSubtitle')}>
        <CardGrid
          caption={k('tabOverview')}
          rows={ITEMS}
          rowKey={(r) => r.id}
          renderCard={(r) => (
            <article className="app-gridcard">
              <div className="app-gridcard__body">
                <span className="app-gridcard__title">{r.id}</span>
                <StatusBadge kind="item" value={r.status} />
              </div>
            </article>
          )}
        />
      </SectionCard>
      <DetailPage
        title={GALLERY_SAMPLE_REF}
        subtitle={k('detailSubtitle')}
        status={<StatusBadge kind="item" value="ACTIVE" />}
        actions={<Button variant="danger">{k('reject')}</Button>}
        back={{ to: '#', label: k('listTitle') }}
        tabsLabel={k('tabs')}
        activeTab={tab}
        onTabChange={setTab}
        tabs={[
          { id: 'overview', label: k('tabOverview'), content: <Heading level={2}>{k('overviewBody')}</Heading> },
          {
            id: 'history',
            label: k('tabHistory'),
            content: <Timeline entries={entries} ariaLabel={k('tabHistory')} empty={k('noHistory')} />,
          },
          {
            id: 'payload',
            label: k('tabPayload'),
            content: <JsonViewer value={AUDIT_PAYLOAD} label={k('tabPayload')} />,
          },
        ]}
        aside={
          <KeyValue
            placeholder={k('empty')}
            items={[
              { key: 'region', label: k('region'), value: k('regionName') },
              { key: 'amount', label: k('amount'), value: '45.500', ltr: true },
              { key: 'note', label: k('note'), value: '' },
            ]}
          />
        }
      />
    </Card>
  );
}
