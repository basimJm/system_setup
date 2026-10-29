import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ExportFormat } from '@/constants/dateRange';
import { initialRangeValue, type DateRangeValue } from '@/domain/shared/dateRange';
import { DateRangePicker } from '@/presentation/components/data/DateRangePicker';
import { ExportMenu } from '@/presentation/components/data/ExportMenu';
import { FilterBar } from '@/presentation/components/data/FilterBar';
import { FiltersSection } from '@/presentation/pages/design/FiltersSection';
import { axeViolations } from './helpers/axe';
import { renderWithApp } from './helpers/render';

const NOW = new Date('2026-10-14T09:00:00Z');

function PickerHarness({ allowCompare = true }: { allowCompare?: boolean }) {
  const [value, setValue] = useState<DateRangeValue>(initialRangeValue(NOW));
  return (
    <>
      <DateRangePicker value={value} onChange={setValue} now={NOW} allowCompare={allowCompare} />
      <output>{`${value.preset}|${value.from}|${value.to}|${String(value.compare)}`}</output>
    </>
  );
}

describe('DateRangePicker', () => {
  it('shows the default preset and its days', () => {
    renderWithApp(<PickerHarness />);
    expect(screen.getByLabelText('Period')).toHaveValue('last7');
    expect(screen.getByRole('status')).toHaveTextContent('last7|2026-10-08|2026-10-14|false');
    expect(screen.getByText(/2026-10-08 – 2026-10-14/)).toBeVisible();
  });

  it('choosing a preset resolves its days in Amman', async () => {
    renderWithApp(<PickerHarness />);
    await userEvent.selectOptions(screen.getByLabelText('Period'), 'lastMonth');
    expect(screen.getByRole('status')).toHaveTextContent('lastMonth|2026-09-01|2026-09-30|false');
    await userEvent.selectOptions(screen.getByLabelText('Period'), 'today');
    expect(screen.getByRole('status')).toHaveTextContent('today|2026-10-14|2026-10-14|false');
  });

  it('compare shows the previous period of the same length', async () => {
    renderWithApp(<PickerHarness />);
    await userEvent.click(screen.getByRole('switch', { name: 'Compare with the previous period' }));
    expect(screen.getByRole('status')).toHaveTextContent('true');
    expect(screen.getByText(/vs 2026-10-01 – 2026-10-07/)).toBeVisible();
  });

  it('compare can be left out', () => {
    renderWithApp(<PickerHarness allowCompare={false} />);
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('custom shows two date fields and only reports a valid range', async () => {
    renderWithApp(<PickerHarness />);
    await userEvent.selectOptions(screen.getByLabelText('Period'), 'custom');
    const from = screen.getByLabelText('From');
    const to = screen.getByLabelText('To');
    expect(from).toHaveValue('2026-10-08');
    fireEvent.change(from, { target: { value: '2026-10-20' } });
    expect(screen.getByRole('alert')).toHaveTextContent('The end must be after the start');
    expect(screen.getByRole('status')).toHaveTextContent('custom|2026-10-08|2026-10-14');
    fireEvent.change(to, { target: { value: '2026-10-25' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('custom|2026-10-20|2026-10-25');
  });

  it('uses Arabic digits in Arabic', () => {
    renderWithApp(<PickerHarness />, undefined, 'ar');
    expect(screen.getByText(/٢٠٢٦-١٠-٠٨ – ٢٠٢٦-١٠-١٤/)).toBeVisible();
  });
});

describe('FilterBar', () => {
  it('renders the controls, one chip per active filter, remove and clear all', async () => {
    const remove = vi.fn();
    const clear = vi.fn();
    renderWithApp(
      <FilterBar
        active={[
          { key: 'city', label: 'City: Amman', onRemove: remove },
          { key: 'state', label: 'State: Live', onRemove: () => undefined },
        ]}
        onClearAll={clear}
      >
        <button type="button">control</button>
      </FilterBar>,
    );
    expect(screen.getByRole('button', { name: 'control' })).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter City: Amman' }));
    expect(remove).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('shows no chip list when nothing is applied', () => {
    renderWithApp(
      <FilterBar>
        <span>x</span>
      </FilterBar>,
    );
    expect(screen.queryByRole('list')).toBeNull();
  });
});

describe('ExportMenu', () => {
  it('offers the three formats and exports the chosen one with progress and success toasts', async () => {
    let finish: () => void = () => undefined;
    const onExport = vi.fn(
      (_format: ExportFormat) =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    renderWithApp(<ExportMenu onExport={onExport} />);
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    // Design list-card menu: each format has its file chip (XLS / CSV / PDF, decorative) before the name.
    for (const name of ['Excel (.xlsx)', 'CSV', 'PDF'])
      expect(screen.getByRole('button', { name })).toBeVisible();
    expect(document.querySelector('.app-export__chip--xlsx')).toHaveTextContent('XLS');
    expect(document.querySelector('.app-export__chip--pdf')).toHaveAttribute('aria-hidden', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'CSV' }));
    expect(onExport).toHaveBeenCalledWith('CSV');
    expect(await screen.findByText('Preparing the CSV export…')).toBeVisible();
    expect(screen.getByRole('button', { name: /Export/ })).toBeDisabled();
    await act(async () => {
      finish();
      await Promise.resolve();
    });
    expect(await screen.findByText('Export ready')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();
  });

  it('shows an error toast when the export fails and becomes usable again', async () => {
    renderWithApp(
      <ExportMenu onExport={() => Promise.reject(new Error('boom'))} formats={['PDF']} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.queryByRole('button', { name: 'CSV' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'PDF' }));
    expect(await screen.findByText('The export failed. Please try again.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    renderWithApp(<ExportMenu onExport={() => Promise.resolve()} />);
    const trigger = screen.getByRole('button', { name: 'Export' });
    await userEvent.click(trigger);
    expect(screen.getByRole('group', { name: 'Export' })).toBeVisible();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Export' })).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('can be disabled', () => {
    renderWithApp(<ExportMenu onExport={() => Promise.resolve()} disabled />);
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
  });
});

describe('FiltersSection (gallery)', () => {
  it('applies, removes and clears filters, and is accessible', async () => {
    renderWithApp(
      <main>
        <FiltersSection />
      </main>,
    );
    await userEvent.selectOptions(screen.getByLabelText('Region'), 'irbid');
    expect(screen.getByText('Region: South')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter Region: South' }));
    expect(screen.queryByText('Region: South')).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Period'), 'thisMonth');
    expect(screen.getByText('This month', { selector: 'span span' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByLabelText('Period')).toHaveValue('last7');
    expect(await axeViolations()).toEqual([]);
  });
});
