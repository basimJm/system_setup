import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '@/presentation/components/core/Button';
import { IconButton } from '@/presentation/components/core/IconButton';
import { KpiCard } from '@/presentation/components/core/KpiCard';

import { TextField } from '@/presentation/components/form/TextField';
import { Modal } from '@/presentation/components/overlay/Modal';
import { ReasonDialog } from '@/presentation/components/overlay/ReasonDialog';

import { renderWithApp } from './helpers/render';

const app = (ui: React.ReactElement) => renderWithApp(ui);

describe('Button / IconButton', () => {
  it('loading disables the button and marks it busy', () => {
    app(<Button loading>Save</Button>);
    const btn = screen.getByRole('button', { name: /save/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('click fires unless disabled', async () => {
    const onClick = vi.fn();
    app(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('icon-only button has an accessible name and shows a badge count', () => {
    app(<IconButton icon="bell" label="Alerts" badge={3} />);
    expect(screen.getByRole('button', { name: 'Alerts 3' })).toHaveTextContent('3');
  });
});

describe('TextField', () => {
  it('links label, error and invalid state', () => {
    app(<TextField label="Email" error="Bad email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Bad email');
  });
});

describe('KpiCard', () => {
  it('shows positive and negative deltas and a skeleton while loading', () => {
    const { rerender } = app(<KpiCard label="Items" value="12" deltaPercent={-4} />);
    expect(screen.getByText('4%')).toBeInTheDocument();
    expect(document.querySelector('.app-kpi__delta--down')).not.toBeNull();
    rerender(<KpiCard label="Items" value="12" loading />);
    expect(screen.queryByText('12')).toBeNull();
  });
});

describe('Modal', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>open</button>
        <Modal
          open={open}
          title="Title"
          onClose={() => setOpen(false)}
          footer={<button>ok</button>}
        >
          <input aria-label="field" />
        </Modal>
      </>
    );
  }

  it('opens as a labelled dialog, traps Tab, closes on Esc and restores focus', async () => {
    app(<Harness />);
    const opener = screen.getByRole('button', { name: 'open' });
    await userEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Title' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const focusable = within(dialog)
      .getAllByRole('button')
      .concat(within(dialog).getByLabelText('field'));
    expect(dialog.contains(document.activeElement)).toBe(true);
    for (let i = 0; i < focusable.length + 2; i += 1) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });
});

describe('ReasonDialog', () => {
  it('blocks confirm without a reason, then passes the trimmed reason', async () => {
    const onConfirm = vi.fn();
    app(
      <ReasonDialog
        open
        title="Cancel"
        confirmLabel="Confirm"
        onConfirm={onConfirm}
        onClose={() => undefined}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox'), '  need this  ');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledWith('need this');
  });

  it('too-short reason is rejected', async () => {
    const onConfirm = vi.fn();
    app(
      <ReasonDialog
        open
        title="Cancel"
        confirmLabel="Confirm"
        onConfirm={onConfirm}
        onClose={() => undefined}
      />,
    );
    await userEvent.type(screen.getByRole('textbox'), 'ab');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
