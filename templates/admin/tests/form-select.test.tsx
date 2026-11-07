import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Combobox } from '@/presentation/components/form/Combobox';
import { MultiSelect } from '@/presentation/components/form/MultiSelect';
import { renderWithApp } from './helpers/render';

const OPTIONS = [
  { value: 'northville', label: 'Northville' },
  { value: 'eastford', label: 'Eastford' },
  { value: 'southport', label: 'Southport' },
];

describe('Combobox', () => {
  function Harness() {
    const [value, setValue] = useState<string | null>(null);
    return (
      <>
        <Combobox label="City" options={OPTIONS} value={value} onValueChange={setValue} />
        <output>{value ?? 'none'}</output>
      </>
    );
  }

  it('filters while typing, picks with Enter and shows the label after closing', async () => {
    renderWithApp(<Harness />);
    const input = screen.getByRole('combobox', { name: 'City' });
    await userEvent.click(input);
    expect(screen.getAllByRole('option')).toHaveLength(3);
    await userEvent.type(input, 'ea');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('eastford');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input).toHaveValue('Eastford');
  });

  it('moves with the arrows, marks the active option and closes with Escape', async () => {
    renderWithApp(<Harness />);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    const options = screen.getAllByRole('option');
    expect(input).toHaveAttribute('aria-activedescendant', options[2]?.id);
    await userEvent.keyboard('{ArrowUp}');
    expect(input).toHaveAttribute('aria-activedescendant', options[1]?.id);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('none');
  });

  it('picks with the mouse and says so when nothing matches', async () => {
    renderWithApp(<Harness />);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    await userEvent.type(input, 'zzz');
    expect(screen.getByText('No matching options')).toBeVisible();
    await userEvent.clear(input);
    await userEvent.click(screen.getByRole('option', { name: 'Southport' }));
    expect(screen.getByRole('status')).toHaveTextContent('southport');
  });

  it('closes when focus leaves the widget', async () => {
    renderWithApp(
      <>
        <Harness />
        <button type="button">outside</button>
      </>,
    );
    await userEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('MultiSelect', () => {
  function Harness() {
    const [value, setValue] = useState<string[]>([]);
    return (
      <>
        <MultiSelect label="Cities" options={OPTIONS} value={value} onValueChange={setValue} />
        <output>{value.join(',') || 'none'}</output>
      </>
    );
  }

  it('toggles options, keeps the list open and shows removable chips', async () => {
    renderWithApp(<Harness />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: 'Northville' }));
    await userEvent.click(screen.getByRole('option', { name: 'Southport' }));
    expect(screen.getByRole('status')).toHaveTextContent('northville,southport');
    expect(screen.getByRole('listbox')).toBeVisible();
    expect(screen.getByRole('option', { name: 'Northville' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Remove Northville' }));
    expect(screen.getByRole('status')).toHaveTextContent('southport');
    await userEvent.click(screen.getByRole('option', { name: 'Southport' }));
    expect(screen.getByRole('status')).toHaveTextContent('none');
  });

  it('Backspace on an empty query removes the last chip; Enter picks the active option', async () => {
    renderWithApp(<Harness />);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    await userEvent.keyboard('{Enter}{ArrowDown}{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('northville,eastford');
    await userEvent.keyboard('{Backspace}');
    expect(screen.getByRole('status')).toHaveTextContent('northville');
    await userEvent.type(input, 'q');
    await userEvent.keyboard('{Backspace}{Backspace}');
    expect(screen.getByRole('status')).toHaveTextContent('none');
  });
});
