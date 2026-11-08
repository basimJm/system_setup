import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DateField } from '@/presentation/components/form/DateField';
import { Field } from '@/presentation/components/form/Field';
import { FormActions } from '@/presentation/components/form/FormActions';
import { MoneyField } from '@/presentation/components/form/MoneyField';
import { NumberField } from '@/presentation/components/form/NumberField';
import { SearchField } from '@/presentation/components/form/SearchField';
import { FormsSection } from '@/presentation/pages/design/FormsSection';
import { axeViolations } from './helpers/axe';
import { localInstant } from './helpers/zone';
import { renderWithApp } from './helpers/render';

afterEach(() => vi.useRealTimers());

describe('Field', () => {
  it('labels the control and shows the error instead of the hint', () => {
    renderWithApp(
      <Field label="Name" hint="Hint" error="Broken">
        {(c) => <input {...c} />}
      </Field>,
    );
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Broken');
    expect(screen.queryByText('Hint')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
  });

  it('shows the hint when there is no error', () => {
    renderWithApp(
      <Field label="Name" hint="Hint">
        {(c) => <input {...c} />}
      </Field>,
    );
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByText('Hint')).toBeVisible();
  });
});

describe('NumberField', () => {
  function Harness({ decimals = 0 }: { decimals?: number }) {
    const [value, setValue] = useState<number | null>(null);
    return (
      <>
        <NumberField label="Seats" value={value} onValueChange={setValue} decimals={decimals} />
        <output>{value === null ? 'none' : String(value)}</output>
      </>
    );
  }

  it('drops junk, accepts Arabic digits and reports a real number', async () => {
    renderWithApp(<Harness />);
    const input = screen.getByLabelText('Seats');
    await userEvent.type(input, 'a1٢b3');
    expect(input).toHaveValue('123');
    expect(screen.getByRole('status')).toHaveTextContent('123');
  });

  it('reports null while empty and keeps a trailing dot while typing decimals', async () => {
    renderWithApp(<Harness decimals={2} />);
    const input = screen.getByLabelText('Seats');
    await userEvent.type(input, '1.');
    expect(input).toHaveValue('1.');
    expect(screen.getByRole('status')).toHaveTextContent('1');
    await userEvent.type(input, '256');
    expect(input).toHaveValue('1.25');
    await userEvent.clear(input);
    expect(screen.getByRole('status')).toHaveTextContent('none');
  });

  it('shows a value that changes from outside', () => {
    const { rerender } = renderWithApp(
      <NumberField label="Seats" value={3} onValueChange={() => undefined} />,
    );
    expect(screen.getByLabelText('Seats')).toHaveValue('3');
    rerender(<NumberField label="Seats" value={null} onValueChange={() => undefined} />);
    expect(screen.getByLabelText('Seats')).toHaveValue('');
  });
});

describe('MoneyField', () => {
  it('limits to three decimals and shows the currency', async () => {
    const onChange = vi.fn();
    function Harness() {
      const [v, setV] = useState('');
      return (
        <MoneyField
          label="Price"
          value={v}
          currencyLabel="KWD"
          onValueChange={(next) => {
            onChange(next);
            setV(next);
          }}
        />
      );
    }
    renderWithApp(<Harness />);
    const input = screen.getByLabelText('Price');
    await userEvent.type(input, '12.3456');
    expect(input).toHaveValue('12.345');
    expect(onChange).toHaveBeenLastCalledWith('12.345');
    expect(screen.getByText('KWD')).toBeVisible();
  });
});

describe('DateField', () => {
  it('emits real days and clears on invalid input', () => {
    const onChange = vi.fn();
    renderWithApp(<DateField label="Start" value="2026-10-01" onValueChange={onChange} />);
    const input = screen.getByLabelText('Start');
    fireEvent.change(input, { target: { value: '2026-10-14' } });
    expect(onChange).toHaveBeenLastCalledWith('2026-10-14');
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('passes min and max to the browser', () => {
    renderWithApp(
      <DateField
        label="Start"
        value=""
        onValueChange={() => undefined}
        min="2026-01-01"
        max="2026-12-31"
      />,
    );
    expect(screen.getByLabelText('Start')).toHaveAttribute('min', '2026-01-01');
    expect(screen.getByLabelText('Start')).toHaveAttribute('max', '2026-12-31');
  });
});

describe('SearchField', () => {
  it('calls onSearch once, 500 ms after typing stops, never on mount', async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    renderWithApp(<SearchField label="Search" onSearch={onSearch} />);
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(onSearch).not.toHaveBeenCalled();
    const input = screen.getByRole('searchbox', { name: 'Search' });
    fireEvent.change(input, { target: { value: 'sal' } });
    await act(() => vi.advanceTimersByTimeAsync(300));
    fireEvent.change(input, { target: { value: ' plan ' } });
    await act(() => vi.advanceTimersByTimeAsync(499));
    expect(onSearch).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('plan');
  });

  it('clears with the button and with Escape, and searches for the empty query', async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    renderWithApp(<SearchField label="Search" onSearch={onSearch} initialValue="abc" />);
    const input = screen.getByRole('searchbox');
    expect(input).toHaveValue('abc');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(input).toHaveValue('');
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(onSearch).toHaveBeenCalledWith('');
    fireEvent.change(input, { target: { value: 'x' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });
});

describe('FormActions', () => {
  it('disables Save and Cancel until the form is dirty', () => {
    const { rerender } = renderWithApp(<FormActions dirty={false} onCancel={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    rerender(<FormActions dirty onCancel={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });

  it('shows busy state while submitting, and no Cancel without a handler', () => {
    renderWithApp(<FormActions dirty submitting />);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('prints who and when in the business zone 12-hour time, with Arabic digits in Arabic', () => {
    const lastUpdated = { by: 'Dana', at: localInstant('2026-10-12', 12, 30).toISOString() };
    const { unmount } = renderWithApp(<FormActions dirty={false} lastUpdated={lastUpdated} />);
    expect(screen.getByText(/Last updated by Dana/)).toHaveTextContent(/12:30/);
    unmount();
    renderWithApp(<FormActions dirty={false} lastUpdated={lastUpdated} />, undefined, 'ar');
    expect(screen.getByText(/آخر تحديث بواسطة Dana/)).toHaveTextContent(/١٢:٣٠/);
  });

  it('calls onCancel', async () => {
    const onCancel = vi.fn();
    renderWithApp(<FormActions dirty onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('FormsSection (useZodForm end to end)', () => {
  it('shows translated errors for an empty submit, then accepts a valid form', async () => {
    renderWithApp(<FormsSection />);
    await userEvent.type(screen.getByLabelText('Item name'), 'Plan');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findAllByText('This field is required')).length).toBeGreaterThan(0);

    await userEvent.type(screen.getByLabelText('Price'), '0');
    await userEvent.click(screen.getByRole('combobox', { name: 'Region' }));
    await userEvent.click(screen.getByRole('option', { name: 'North' }));
    await userEvent.type(screen.getByLabelText('Seats'), '4');
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2026-10-10' } });
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2026-10-10' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('The amount must be greater than zero')).toBeVisible();
    expect(screen.getByText('The end must be after the start')).toBeVisible();

    await userEvent.type(screen.getByLabelText('Price'), '.5');
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2026-10-11' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Saved/)).toBeVisible();
  });

  it('Cancel resets the form to its defaults', async () => {
    renderWithApp(<FormsSection />);
    const name = screen.getByLabelText('Item name');
    await userEvent.type(name, 'Hair');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(name).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('has no accessibility violations in English and Arabic', async () => {
    const english = renderWithApp(
      <main>
        <FormsSection />
      </main>,
    );
    expect(await axeViolations()).toEqual([]);
    english.unmount();
    renderWithApp(
      <main>
        <FormsSection />
      </main>,
      undefined,
      'ar',
    );
    expect(await axeViolations()).toEqual([]);
  });
});
