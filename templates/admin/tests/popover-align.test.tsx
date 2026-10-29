import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ColumnPicker } from '@/presentation/components/data/ColumnPicker';
import { renderWithApp } from './helpers/render';

const COLUMNS = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Name' },
];

describe('usePopoverAlign', () => {
  beforeEach(() => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(400);
  });
  afterEach(() => vi.restoreAllMocks());

  it('flips the column panel to the start edge when it would leave the viewport', async () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: -40,
      right: 150,
      top: 0,
      bottom: 0,
      width: 190,
      height: 0,
      x: -40,
      y: 0,
      toJSON: () => ({}),
    });
    renderWithApp(
      <ColumnPicker
        columns={COLUMNS}
        visibility={{ hidden: new Set(), toggle: () => undefined, reset: () => undefined }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Columns' }));
    expect(screen.getByRole('group', { name: 'Columns' })).toHaveAttribute('data-align', 'start');
    rect.mockRestore();
  });

  it('keeps the end alignment when the panel fits', async () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      right: 150,
      top: 0,
      bottom: 0,
      width: 140,
      height: 0,
      x: 10,
      y: 0,
      toJSON: () => ({}),
    });
    renderWithApp(
      <ColumnPicker
        columns={COLUMNS}
        visibility={{ hidden: new Set(), toggle: () => undefined, reset: () => undefined }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Columns' }));
    expect(screen.getByRole('group', { name: 'Columns' })).toHaveAttribute('data-align', 'end');
    rect.mockRestore();
  });
});
