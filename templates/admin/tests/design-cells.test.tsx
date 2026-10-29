import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KpiCard } from '@/presentation/components/core/KpiCard';
import { PageHeader } from '@/presentation/components/core/PageHeader';
import { DataTable } from '@/presentation/components/data/DataTable';
import { EntityCell, initialOf, RatingCell } from '@/presentation/components/data/TableCells';
import { renderWithApp } from './helpers/render';

describe('design table cells', () => {
  it.each([
    ['Noor Studio', 'N'],
    ['  laith', 'L'],
    ['ليث', 'ل'],
    ['', ''],
  ])('initialOf(%j) = %j', (name, initial) => {
    expect(initialOf(name)).toBe(initial);
  });

  it('EntityCell shows the initial, the name, a second line and a badge', () => {
    renderWithApp(<EntityCell name="Noor Studio" sub="+962790000301" badge={<em>new</em>} />);
    expect(screen.getByText('N')).toHaveClass('app-entity__initial');
    expect(screen.getByText('Noor Studio')).toHaveClass('app-entity__name');
    expect(screen.getByText('+962790000301')).toHaveClass('app-entity__sub');
    expect(screen.getByText('new')).toBeInTheDocument();
  });

  it('RatingCell shows the average and count in the language digits', () => {
    const { unmount } = renderWithApp(<RatingCell avg={4.5} count={9} language="en" />);
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('(9)')).toBeInTheDocument();
    unmount();
    renderWithApp(<RatingCell avg={4.5} count={9} language="ar" />, undefined, 'ar');
    expect(screen.getByText('(٩)')).toBeInTheDocument();
  });
});

describe('design header and KPI blocks', () => {
  it('PageHeader shows badges next to the title', () => {
    renderWithApp(<PageHeader title="Items" badges={<span>Live</span>} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Items' }).parentElement).toHaveClass(
      'app-pageheader__titlerow',
    );
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('KpiCard lists its breakdown under the value, and none while loading', () => {
    const parts = [{ key: 'a', label: 'payment.succeeded', value: '60' }];
    const { unmount } = renderWithApp(
      <KpiCard label="Payments" value="64" deltaPercent={-3.2} parts={parts} />,
    );
    expect(screen.getByText('payment.succeeded').closest('li')).toHaveClass('app-kpi__part');
    expect(screen.getByText('3.2%').closest('.app-kpi__delta')).toHaveClass('app-kpi__delta--down');
    unmount();
    renderWithApp(<KpiCard label="Payments" value="64" loading parts={parts} />);
    expect(screen.queryByText('payment.succeeded')).toBeNull();
  });
});

describe('design row tint', () => {
  it('rows that need attention get the alert class, others do not', () => {
    renderWithApp(
      <DataTable
        caption="Records"
        columns={[
          { key: 'id', header: 'Ref', render: (r: { id: string; failed: boolean }) => r.id },
        ]}
        rows={[
          { id: 'TX-1', failed: true },
          { id: 'TX-2', failed: false },
        ]}
        rowKey={(r) => r.id}
        rowAlert={(r) => r.failed}
      />,
    );
    expect(screen.getByText('TX-1').closest('tr')).toHaveClass('app-table__row--alert');
    expect(screen.getByText('TX-2').closest('tr')).not.toHaveClass('app-table__row--alert');
  });

  it('a single rating shows no count', () => {
    renderWithApp(<RatingCell avg={5} language="en" />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.queryByText(/\(/)).toBeNull();
  });
});
