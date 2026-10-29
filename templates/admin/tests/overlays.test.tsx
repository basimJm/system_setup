import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '@/presentation/components/overlay/ConfirmDialog';
import { Drawer } from '@/presentation/components/overlay/Drawer';
import { Menu } from '@/presentation/components/overlay/Menu';
import { ReasonDialog } from '@/presentation/components/overlay/ReasonDialog';
import { OverlaysSection } from '@/presentation/pages/design/OverlaysSection';
import { axeViolations } from './helpers/axe';
import { renderWithApp } from './helpers/render';

function DrawerHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        opener
      </button>
      <Drawer
        open={open}
        title="Details"
        onClose={() => setOpen(false)}
        footer={<button type="button">footer action</button>}
      >
        <input aria-label="inside" />
      </Drawer>
    </>
  );
}

describe('Drawer (and the shared dialog behaviour)', () => {
  it('opens as a labelled modal dialog, moves focus in, and Escape closes and restores focus', async () => {
    renderWithApp(<DrawerHarness />);
    const opener = screen.getByRole('button', { name: 'opener' });
    await userEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Details' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('keeps Tab and Shift+Tab inside', async () => {
    renderWithApp(<DrawerHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'opener' }));
    const close = screen.getByRole('button', { name: 'Close' });
    const footer = screen.getByRole('button', { name: 'footer action' });
    footer.focus();
    await userEvent.tab();
    expect(close).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(footer).toHaveFocus();
  });

  it('closes on a backdrop press but not on a press inside the panel', async () => {
    renderWithApp(<DrawerHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'opener' }));
    fireEvent.mouseDown(screen.getByLabelText('inside'));
    expect(screen.getByRole('dialog')).toBeVisible();
    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;
    fireEvent.mouseDown(backdrop);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders nothing while closed and closes with its close button', async () => {
    renderWithApp(<DrawerHarness />);
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'opener' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('ConfirmDialog', () => {
  const base = { open: true, title: 'Sure?', confirmLabel: 'Do it' };

  it('neutral: primary confirm, calls onConfirm and onClose', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    renderWithApp(
      <ConfirmDialog {...base} description="Text" onConfirm={onConfirm} onClose={onClose} />,
    );
    expect(screen.getByText('Text')).toBeVisible();
    const confirm = screen.getByRole('button', { name: 'Do it' });
    expect(confirm).toHaveClass('app-btn--primary');
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('destructive: red confirm; loading disables it', () => {
    renderWithApp(
      <ConfirmDialog
        {...base}
        destructive
        loading
        onConfirm={() => undefined}
        onClose={() => undefined}
      />,
    );
    const confirm = screen.getByRole('button', { name: /Do it/ });
    expect(confirm).toHaveClass('app-btn--danger');
    expect(confirm).toBeDisabled();
  });

  it('is absent when closed', () => {
    renderWithApp(
      <ConfirmDialog
        {...base}
        open={false}
        onConfirm={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('ReasonDialog variants', () => {
  it.each([
    [false, 'app-btn--primary'],
    [true, 'app-btn--danger'],
  ])('destructive=%s uses %s and still requires a reason', async (destructive, className) => {
    const onConfirm = vi.fn();
    renderWithApp(
      <ReasonDialog
        open
        title="Why"
        destructive={destructive}
        confirmLabel="Go"
        onConfirm={onConfirm}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: 'Go' })).toHaveClass(className);
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeVisible();
    await userEvent.type(screen.getByLabelText(/Reason/), '  because  ');
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onConfirm).toHaveBeenCalledWith('because');
  });
});

describe('Menu', () => {
  function MenuHarness({ onSelect = () => undefined }: { onSelect?: (key: string) => void }) {
    return (
      <Menu
        label="Actions"
        items={[
          { key: 'view', label: 'View', onSelect: () => onSelect('view') },
          { key: 'edit', label: 'Edit', onSelect: () => onSelect('edit'), disabled: true },
          { key: 'delete', label: 'Delete', onSelect: () => onSelect('delete'), danger: true },
        ]}
      />
    );
  }

  it('opens a menu, focuses the first enabled item and skips disabled ones with the arrows', async () => {
    renderWithApp(<MenuHarness />);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await userEvent.click(trigger);
    expect(screen.getByRole('menu', { name: 'Actions' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'View' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'View' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: 'View' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
  });

  it('Enter selects the item, runs its action and closes the menu', async () => {
    const onSelect = vi.fn();
    renderWithApp(<MenuHarness onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('delete');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('marks dangerous items and never runs a disabled one', async () => {
    const onSelect = vi.fn();
    renderWithApp(<MenuHarness onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveClass('app-menu__item--danger');
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeDisabled();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    renderWithApp(<MenuHarness />);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });
});

describe('OverlaysSection (gallery)', () => {
  it('opens every overlay, records the last action and is accessible', async () => {
    renderWithApp(
      <main>
        <OverlaysSection />
      </main>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Confirm dialog' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(screen.getByText('Last action: Confirm dialog')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Drawer' }));
    expect(screen.getByRole('dialog', { name: 'Details' })).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Actions menu' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'View' }));
    expect(screen.getByText('Last action: View')).toBeVisible();
    expect(await axeViolations()).toEqual([]);
  });
});
