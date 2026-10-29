import { useTranslation } from 'react-i18next';
import { Card } from '../../components/core/Card';
import { Heading } from '../../components/core/Heading';
import { BarChart } from '../../components/charts/BarChart';
import { CohortHeatmap } from '../../components/charts/CohortHeatmap';
import { DonutChart } from '../../components/charts/DonutChart';
import { FunnelChart } from '../../components/charts/FunnelChart';
import { LineChart } from '../../components/charts/LineChart';
import { Sparkline } from '../../components/charts/Sparkline';

const DAYS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'] as const;
const CREATED = [120, 150, 138, 180, 210, 260, 240];
const CANCELLED = [10, 14, 9, 22, 18, 30, 25];
const STATUS_COUNTS: readonly [string, number][] = [
  ['approved', 640],
  ['pending', 120],
  ['rejected', 45],
  ['cancelled', 80],
];
const FUNNEL_COUNTS: readonly [string, number][] = [
  ['installs', 1000],
  ['registered', 620],
  ['searched', 480],
  ['booked', 210],
  ['paid', 150],
];
const COHORTS: readonly [string, (number | null)[]][] = [
  ['w1', [1, 0.42, 0.31, 0.25]],
  ['w2', [1, 0.38, 0.27, null]],
  ['w3', [1, 0.45, null, null]],
];

/** Gallery section for the charts kit (ADM-019): the six chart types, the sparkline, View data and CSV export. */
export function ChartsSection() {
  const { t } = useTranslation();
  const k = (key: string) => t(`designKits.charts.${key}`);
  const labels = DAYS.map((d) => k(`days.${d}`));
  return (
    <Card className="app-stack" aria-label={k('title')}>
      <Heading level={2}>{k('title')}</Heading>
      <div className="app-row">
        <span>{k('trend')}</span>
        <Sparkline values={CREATED} label={k('trendLabel')} />
      </div>
      <LineChart
        title={k('lineTitle')}
        categoryHeader={k('day')}
        labels={labels}
        filename="items-line"
        series={[
          { key: 'created', label: k('created'), values: CREATED },
          { key: 'cancelled', label: k('cancelled'), values: CANCELLED },
        ]}
      />
      <BarChart
        title={k('barTitle')}
        categoryHeader={k('day')}
        labels={labels}
        filename="items-bar"
        series={[
          { key: 'created', label: k('created'), values: CREATED },
          { key: 'cancelled', label: k('cancelled'), values: CANCELLED },
        ]}
      />
      <BarChart
        stacked
        title={k('stackedTitle')}
        categoryHeader={k('day')}
        labels={labels}
        filename="items-stacked"
        series={[
          { key: 'created', label: k('created'), values: CREATED },
          { key: 'cancelled', label: k('cancelled'), values: CANCELLED },
        ]}
      />
      <DonutChart
        title={k('donutTitle')}
        headers={[k('status'), k('count'), k('share')]}
        centerLabel={k('items')}
        filename="item-statuses"
        data={STATUS_COUNTS.map(([key, value]) => ({ key, value, label: k(`statuses.${key}`) }))}
      />
      <FunnelChart
        title={k('funnelTitle')}
        headers={[k('step'), k('count'), k('ofFirst'), k('ofPrevious')]}
        filename="onboarding-funnel"
        steps={FUNNEL_COUNTS.map(([key, value]) => ({ key, value, label: k(`steps.${key}`) }))}
      />
      <CohortHeatmap
        title={k('heatTitle')}
        cohortHeader={k('cohort')}
        columnLabels={['0', '1', '2', '3'].map((n) => `${k('week')} ${n}`)}
        filename="retention"
        rows={COHORTS.map(([key, values]) => ({ key, values, label: k(`cohorts.${key}`) }))}
      />
    </Card>
  );
}
