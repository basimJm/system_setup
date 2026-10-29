import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { hasDiff, humanizeAction } from '@/domain/audit/audit';
import AuditPage from '@/presentation/audit/AuditPage';
import { makeContainer, renderWithApp } from './helpers/render';

const open = (c = makeContainer()) =>
  renderWithApp(
    <MemoryRouter>
      <AuditPage />
    </MemoryRouter>,
    c,
  );
const bodyRows = () => screen.getAllByRole('row').length - 1;

describe('audit rules', () => {
  it('humanizes actions and detects a diff', () => {
    expect(humanizeAction('ITEM_SET_INACTIVE')).toBe('Item set inactive');
    expect(humanizeAction('X')).toBe('X');
    expect(hasDiff({ before: { a: 1 } })).toBe(true);
    expect(hasDiff({})).toBe(false);
  });
});

describe('AuditPage', () => {
  it('lists records newest data with reason and IP', async () => {
    open();
    await waitFor(() => expect(bodyRows()).toBe(3));
    expect(screen.getByText('Item update')).toBeInTheDocument();
    expect(screen.getAllByText('203.0.113.7').length).toBe(3);
  });

  it('shows the design read-only badge, the raw action code and the device (user agent)', async () => {
    open();
    await waitFor(() => expect(bodyRows()).toBe(3));
    expect(screen.getByText('Read-only')).toBeInTheDocument();
    expect(screen.getByText('ITEM_UPDATE')).toHaveClass('app-cell2__code');
    expect(screen.getByRole('columnheader', { name: 'Device' })).toBeInTheDocument();
  });

  it('opening a record shows the before / after values; one without them says so', async () => {
    open();
    await userEvent.click(await screen.findByText('Item update'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Before')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('After')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await userEvent.click(await screen.findByText('Admin login'));
    expect(
      await screen.findByText('This action stored no before / after values.'),
    ).toBeInTheDocument();
  });

  it('filters by entity type', async () => {
    open();
    await waitFor(() => expect(bodyRows()).toBe(3));
    await userEvent.type(screen.getByLabelText('Entity type'), 'ADMIN');
    await waitFor(() => expect(bodyRows()).toBe(1));
  });

  it('shows the error state with retry', async () => {
    const failing = makeContainer();
    failing.mock?.scenarios.set('serverError');
    open(failing);
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
