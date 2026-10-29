import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BarChart } from '@/presentation/components/charts/BarChart';
import { ChartFrame } from '@/presentation/components/charts/ChartFrame';
import { CohortHeatmap } from '@/presentation/components/charts/CohortHeatmap';
import { DonutChart } from '@/presentation/components/charts/DonutChart';
import { FunnelChart } from '@/presentation/components/charts/FunnelChart';
import { LineChart } from '@/presentation/components/charts/LineChart';
import { Sparkline } from '@/presentation/components/charts/Sparkline';
import { ChartsSection } from '@/presentation/pages/design/ChartsSection';
import { axeViolations } from './helpers/axe';
import { renderWithApp } from './helpers/render';

const labels = ['Mon', 'Tue', 'Wed'];
const series = [
  { key: 'a', label: 'Created', values: [10, 20, 30] },
  { key: 'b', label: 'Cancelled', values: [1, 2, 3] },
];

afterEach(() => vi.restoreAllMocks());

describe('ChartFrame', () => {
  const table = {
    headers: ['Day', 'Count'],
    rows: [
      ['Mon', 5],
      ['Tue', 7],
    ],
  };

  it('hides the data table until asked, then shows exactly the numbers it was given', async () => {
    renderWithApp(
      <ChartFrame title="Chart" table={table} filename="f">
        <p>drawing</p>
      </ChartFrame>,
    );
    expect(screen.queryByRole('table')).toBeNull();
    const toggle = screen.getByRole('button', { name: 'View data' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    const grid = screen.getByRole('table', { name: 'Chart' });
    expect(within(grid).getAllByRole('row')).toHaveLength(3);
    expect(within(grid).getByText('7')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Hide data' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Hide data' }));
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('exports the data as a CSV file with the given name', async () => {
    const create = vi.fn(() => 'blob:x');
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    renderWithApp(
      <ChartFrame title="Chart" table={table} filename="my-file">
        <p>x</p>
      </ChartFrame>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(click).toHaveBeenCalledTimes(1);
    const blob = (create.mock.calls[0] as unknown as [Blob])[0];
    expect(new TextDecoder().decode(await blob.arrayBuffer())).toContain(
      'Day,Count\r\nMon,5\r\nTue,7',
    );
  });
});

describe('LineChart', () => {
  it('draws one line and one point per value for every series, with tooltips and a legend', () => {
    renderWithApp(
      <LineChart title="Items" categoryHeader="Day" labels={labels} series={series} filename="f" />,
    );
    expect(document.querySelectorAll('polyline')).toHaveLength(2);
    expect(document.querySelectorAll('circle')).toHaveLength(6);
    expect(screen.getByRole('img', { name: 'Items' })).toBeVisible();
    expect(screen.getByText('Created · Tue: 20', { selector: 'title' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Created',
      'Cancelled',
    ]);
  });

  it('the data table has the category column and one column per series', async () => {
    renderWithApp(
      <LineChart title="Items" categoryHeader="Day" labels={labels} series={series} filename="f" />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'View data' }));
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Day',
      'Created',
      'Cancelled',
    ]);
  });

  it('draws axis labels with Arabic digits in Arabic', () => {
    renderWithApp(
      <LineChart title="T" categoryHeader="Day" labels={labels} series={series} filename="f" />,
      undefined,
      'ar',
    );
    expect(screen.getAllByText('٠').length).toBeGreaterThan(0);
  });

  it('survives no data', () => {
    renderWithApp(
      <LineChart title="T" categoryHeader="Day" labels={[]} series={[]} filename="f" />,
    );
    expect(screen.getByRole('img', { name: 'T' })).toBeVisible();
  });
});

describe('BarChart', () => {
  it('draws one bar per value; stacked mode keeps one column per category', () => {
    const { unmount } = renderWithApp(
      <BarChart title="B" categoryHeader="Day" labels={labels} series={series} filename="f" />,
    );
    const grouped = [...document.querySelectorAll('svg rect')];
    expect(grouped).toHaveLength(6);
    const xs = new Set(grouped.map((r) => r.getAttribute('x')));
    expect(xs.size).toBe(6);
    unmount();
    renderWithApp(
      <BarChart
        stacked
        title="B"
        categoryHeader="Day"
        labels={labels}
        series={series}
        filename="f"
      />,
    );
    const columns = new Set(
      [...document.querySelectorAll('svg rect')].map((r) => r.getAttribute('x')),
    );
    expect(columns.size).toBe(3);
  });

  it('the axis top fits the stacked total, not only the tallest single bar', () => {
    renderWithApp(
      <BarChart
        stacked
        title="B"
        categoryHeader="Day"
        labels={labels}
        series={series}
        filename="f"
      />,
    );
    expect(screen.getByText('50', { selector: 'text' })).toBeInTheDocument();
  });
});

describe('DonutChart', () => {
  const data = [
    { key: 'a', label: 'Approved', value: 75 },
    { key: 'b', label: 'Pending', value: 25 },
  ];
  it('shows the total in the middle, one segment per non-zero value, and shares in the table', async () => {
    renderWithApp(
      <DonutChart
        title="D"
        headers={['Status', 'Count', 'Share']}
        data={data}
        filename="f"
        centerLabel="items"
      />,
    );
    expect(document.querySelectorAll('svg path')).toHaveLength(2);
    expect(screen.getByText('100', { selector: 'text' })).toBeVisible();
    expect(screen.getByText('Approved: 75 (75%)', { selector: 'title' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'View data' }));
    expect(screen.getByText('75%', { selector: 'td' })).toBeVisible();
  });

  it('shows an empty ring and zero for no data', async () => {
    renderWithApp(
      <DonutChart
        title="D"
        headers={['Status', 'Count', 'Share']}
        data={[{ key: 'a', label: 'A', value: 0 }]}
        filename="f"
      />,
    );
    expect(document.querySelectorAll('svg path')).toHaveLength(0);
    expect(document.querySelector('.app-chart__empty')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'View data' }));
    expect(screen.getByText('0%', { selector: 'td' })).toBeVisible();
  });
});

describe('FunnelChart', () => {
  const steps = [
    { key: 'i', label: 'Installs', value: 1000 },
    { key: 'r', label: 'Registered', value: 500 },
  ];
  it('lists the steps with bar widths and the step-to-step rate', () => {
    renderWithApp(
      <FunnelChart
        title="F"
        headers={['Step', 'Count', 'Of first', 'Of previous']}
        steps={steps}
        filename="f"
      />,
    );
    const items = within(screen.getByRole('list', { name: 'F' })).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[1]).toHaveTextContent('500');
    expect(items[1]).toHaveTextContent('50%');
    expect((items[1]!.querySelector('.app-funnel__bar') as HTMLElement).style.width).toBe('50%');
    expect((items[0]!.querySelector('.app-funnel__bar') as HTMLElement).style.width).toBe('100%');
  });
});

describe('CohortHeatmap', () => {
  it('is a real table, shades by value, leaves future periods empty, localises digits', () => {
    const rows = [
      { key: 'w1', label: 'Week 1', values: [1, 0.5, 0.1] },
      { key: 'w2', label: 'Week 2', values: [1, null, null] },
    ];
    const { unmount } = renderWithApp(
      <CohortHeatmap
        title="H"
        cohortHeader="Cohort"
        columnLabels={['P0', 'P1', 'P2']}
        rows={rows}
        filename="f"
      />,
    );
    const cells = [...document.querySelectorAll('td.app-heat')];
    expect(cells).toHaveLength(6);
    expect(cells[0]).toHaveClass('app-heat--4');
    expect(cells[2]).toHaveClass('app-heat--0');
    expect(cells[4]).toHaveClass('app-heat--none');
    expect(screen.getByRole('rowheader', { name: 'Week 2' })).toBeVisible();
    unmount();
    renderWithApp(
      <CohortHeatmap
        title="H"
        cohortHeader="Cohort"
        columnLabels={['P0']}
        rows={[{ key: 'x', label: 'X', values: [0.5] }]}
        filename="f"
      />,
      undefined,
      'ar',
    );
    expect(screen.getByText('٥٠%')).toBeVisible();
  });
});

describe('Sparkline', () => {
  it('is an image with a label and a line (or a dot for a single value, nothing for none)', () => {
    const { rerender } = renderWithApp(<Sparkline values={[1, 3, 2]} label="Trend" />);
    expect(screen.getByRole('img', { name: 'Trend' })).toBeVisible();
    expect(document.querySelectorAll('polyline')).toHaveLength(1);
    rerender(<Sparkline values={[4]} label="Trend" />);
    expect(document.querySelectorAll('circle')).toHaveLength(1);
    rerender(<Sparkline values={[]} label="Trend" />);
    expect(document.querySelectorAll('polyline, circle')).toHaveLength(0);
  });
});

describe('ChartsSection (gallery)', () => {
  it('renders every chart type with View data and is accessible in both languages', async () => {
    const english = renderWithApp(
      <main>
        <ChartsSection />
      </main>,
    );
    expect(screen.getAllByRole('button', { name: 'View data' })).toHaveLength(6);
    expect(await axeViolations()).toEqual([]);
    english.unmount();
    renderWithApp(
      <main>
        <ChartsSection />
      </main>,
      undefined,
      'ar',
    );
    expect(await axeViolations()).toEqual([]);
  });
});
