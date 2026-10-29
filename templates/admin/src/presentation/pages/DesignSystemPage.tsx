import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TONE_NAMES } from '@/design/tokens/colors';
import { AppError } from '@/infrastructure/errors/AppError';
import { Badge } from '../components/core/Badge';
import { Button } from '../components/core/Button';
import { Card } from '../components/core/Card';
import { KpiCard } from '../components/core/KpiCard';
import { PageHeader } from '../components/core/PageHeader';
import { EmptyState } from '../components/feedback/EmptyState';
import { ErrorState } from '../components/feedback/ErrorState';
import { Skeleton } from '../components/feedback/Skeleton';
import { TextField } from '../components/form/TextField';
import { Select } from '../components/form/Select';
import { Toggle } from '../components/form/Toggle';
import { DataTable, type Column, type SortState } from '../components/data/DataTable';
import { Pagination } from '../components/data/Pagination';
import { Tabs } from '../components/data/Tabs';
import { ReasonDialog } from '../components/overlay/ReasonDialog';
import { useToast } from '../components/overlay/Toast';
import { DEFAULT_PAGE_SIZE } from '@/constants/ui';
import { BasicsSection } from './design/BasicsSection';
import { ChartsSection } from './design/ChartsSection';
import { FiltersSection } from './design/FiltersSection';
import { FormsSection } from './design/FormsSection';
import { OverlaysSection } from './design/OverlaysSection';
import { PrimitivesSection } from './design/PrimitivesSection';
import { StatusSection } from './design/StatusSection';
import { RichTextSection } from './design/RichTextSection';
import { ShellSection } from './design/ShellSection';
import { TableSection } from './design/TableSection';
import { TemplatesSection } from './design/TemplatesSection';

interface DemoRow {
  id: string;
  name: string;
  amount: string;
}
const DEMO_ROWS: readonly DemoRow[] = [
  { id: 'REF-24817', name: 'design.row1', amount: '45.500' },
  { id: 'REF-24818', name: 'design.row2', amount: '120.000' },
];

/** Dev-only gallery of every base component and state (not routed in prod builds). */
export default function DesignSystemPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [dialog, setDialog] = useState(false);
  const [tab, setTab] = useState('a');
  const [sort, setSort] = useState<SortState | undefined>();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const columns: readonly Column<DemoRow>[] = [
    { key: 'id', header: t('design.colRef'), render: (r) => r.id, ltr: true, sortable: true },
    { key: 'name', header: t('design.colName'), render: (r) => t(r.name) },
    {
      key: 'amount',
      header: t('design.colAmount'),
      render: (r) => `${r.amount} ${t('common.currency')}`,
      ltr: true,
      sortable: true,
    },
  ];

  return (
    <>
      <PageHeader title={t('design.title')} subtitle={t('design.subtitle')} />
      <section className="app-grid" aria-label={t('design.kpis')}>
        <KpiCard
          label={t('design.kpiBookings')}
          value="128"
          deltaPercent={12}
          deltaLabel={t('design.vsLastWeek')}
        />
        <KpiCard
          label={t('design.kpiFailures')}
          value="7"
          deltaPercent={-4}
          deltaLabel={t('design.vsLastWeek')}
        />
        <KpiCard label={t('design.kpiLoading')} value="" loading />
      </section>
      <PrimitivesSection />
      <FormsSection />
      <StatusSection />
      <TableSection />
      <FiltersSection />
      <OverlaysSection />
      <TemplatesSection />
      <ChartsSection />
      <RichTextSection />
      <ShellSection />
      <BasicsSection />
      <Card className="app-stack">
        <div className="app-row">
          <Button>{t('design.primary')}</Button>
          <Button variant="secondary">{t('design.secondary')}</Button>
          <Button variant="ghost">{t('design.ghost')}</Button>
          <Button variant="danger" onClick={() => setDialog(true)}>
            {t('design.danger')}
          </Button>
          <Button loading>{t('design.loading')}</Button>
          <Button onClick={() => toast.show(t('design.toast'), 'success')}>
            {t('design.showToast')}
          </Button>
        </div>
        <div className="app-row">
          {TONE_NAMES.map((tone) => (
            <Badge key={tone} tone={tone}>
              {t(`design.tone.${tone}`)}
            </Badge>
          ))}
        </div>
        <div className="app-grid">
          <TextField label={t('design.field')} hint={t('design.hint')} />
          <TextField label={t('design.field')} error={t('design.error')} />
          <Select
            label={t('design.select')}
            options={[
              { value: 'a', label: t('design.optionA') },
              { value: 'b', label: t('design.optionB') },
            ]}
          />
        </div>
        <div className="app-row">
          <Toggle label={t('design.checkbox')} />
          <Toggle kind="switch" label={t('design.switch')} />
        </div>
        <Skeleton width="third" />
      </Card>
      <Tabs
        ariaLabel={t('design.tabs')}
        activeId={tab}
        onChange={setTab}
        items={[
          {
            id: 'a',
            label: t('design.tabA'),
            content: (
              <DataTable
                caption={t('design.table')}
                columns={columns}
                rows={DEMO_ROWS}
                rowKey={(r) => r.id}
                sort={sort}
                onSortChange={setSort}
              />
            ),
          },
          {
            id: 'b',
            label: t('design.tabB'),
            content: (
              <DataTable
                caption={t('design.table')}
                columns={columns}
                rows={[]}
                rowKey={(r) => r.id}
                loading
              />
            ),
          },
          {
            id: 'c',
            label: t('design.tabC'),
            content: (
              <DataTable
                caption={t('design.table')}
                columns={columns}
                rows={[]}
                rowKey={(r) => r.id}
              />
            ),
          },
          {
            id: 'd',
            label: t('design.tabD'),
            content: (
              <ErrorState
                error={new AppError({ kind: 'network' })}
                onRetry={() => toast.show(t('design.retried'))}
              />
            ),
          },
          {
            id: 'e',
            label: t('design.tabE'),
            content: (
              <EmptyState title={t('design.emptyTitle')} description={t('design.emptyText')} />
            ),
          },
        ]}
      />
      <Pagination
        page={page}
        pageSize={size}
        total={240}
        onPageChange={setPage}
        onPageSizeChange={setSize}
      />
      <ReasonDialog
        open={dialog}
        destructive
        title={t('design.dialogTitle')}
        description={t('design.dialogText')}
        confirmLabel={t('design.confirm')}
        onClose={() => setDialog(false)}
        onConfirm={() => {
          setDialog(false);
          toast.show(t('design.done'), 'success');
        }}
      />
    </>
  );
}
