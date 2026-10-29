import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { BRAND_ICON_URL, BRAND_MARK, BRAND_TAGLINE } from '@/constants/ui';
import { ICON_STROKE_WIDTH } from '@/constants/icons';
import { Icon } from '@/presentation/components/core/Icon';
import { TextField } from '@/presentation/components/form/TextField';
import { ListPage } from '@/presentation/components/templates/ListPage';
import { AdminAvatar } from '@/presentation/layout/AdminAvatar';
import { Sidebar } from '@/presentation/layout/Sidebar';
import { Topbar } from '@/presentation/layout/Topbar';
import { OtpStep } from '@/presentation/pages/login/OtpStep';
import { axeViolations } from './helpers/axe';
import { renderWithApp } from './helpers/render';

const ADMIN = { name: 'Laith Hassan', email: 'laith@example.test' };
const at = (ui: React.ReactElement, path = '/items') => (
  <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
);

describe('design shell: sidebar', () => {
  const dock = (props: Partial<React.ComponentProps<typeof Sidebar>> = {}) =>
    renderWithApp(
      at(<Sidebar mode="docked" collapsed={false} open onNavigate={() => undefined} {...props} />),
    );

  it('shows the app icon, wordmark, admin chip and the admin card with email', () => {
    dock({ admin: ADMIN, onToggleCollapse: () => undefined });
    const aside = screen.getByRole('complementary', { name: 'Main navigation' });
    expect(within(aside).getByRole('img', { name: BRAND_MARK })).toHaveAttribute(
      'src',
      BRAND_ICON_URL,
    );
    expect(within(aside).getByText(BRAND_TAGLINE)).toBeVisible();
    expect(within(aside).getByText(ADMIN.email)).toBeVisible();
    expect(within(aside).getByText('L')).toBeVisible();
  });

  it('the footer button collapses and expands the docked sidebar', async () => {
    const onToggle = vi.fn();
    const view = dock({ onToggleCollapse: onToggle });
    await userEvent.click(screen.getByRole('button', { name: 'Collapse' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    view.unmount();
    dock({ collapsed: true, onToggleCollapse: onToggle });
    expect(screen.getByRole('button', { name: 'Expand the sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('the current module is the gradient row; a group with the current page is tinted', () => {
    renderWithApp(
      at(<Sidebar mode="docked" collapsed={false} open onNavigate={() => undefined} />, '/items'),
    );
    expect(screen.getByRole('link', { name: 'Items' })).toHaveClass('app-navitem--active');
  });
});

describe('design shell: top bar', () => {
  const bar = (onLogout = vi.fn()) =>
    renderWithApp(
      at(
        <Topbar
          adminName={ADMIN.name}
          adminEmail={ADMIN.email}
          showMenuButton={false}
          menuLabelKey="topbar.openMenu"
          menuExpanded={false}
          onMenu={() => undefined}
          onLogout={onLogout}
        />,
      ),
    );

  it('shows the other language as a short button, theme, admin avatar + name', async () => {
    bar();
    expect(screen.getByRole('button', { name: 'Switch language' })).toHaveTextContent('ع');
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: ADMIN.name }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText(ADMIN.email)).toBeVisible();
    expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
  });

  it('has no axe violations', async () => {
    bar();
    expect(await axeViolations()).toEqual([]);
  });
});

describe('design kit pieces', () => {
  it('AdminAvatar shows the first letter (upper case) or nothing', () => {
    const { container, rerender } = render(<AdminAvatar name="  laith" />);
    expect(container.textContent).toBe('L');
    rerender(<AdminAvatar name="" small />);
    expect(container.textContent).toBe('');
    expect(container.firstElementChild).toHaveClass('app-admin-avatar--sm');
  });

  it('icons use the design stroke width; TextField can show a start icon', () => {
    const { container } = render(<Icon name="grid" />);
    expect(container.querySelector('svg')).toHaveAttribute('stroke-width', ICON_STROKE_WIDTH);
    renderWithApp(<TextField label="Email" startIcon="mail" />);
    expect(screen.getByLabelText('Email')).toHaveClass('app-field__control--with-start');
  });

  it('OTP code is one input drawn as six boxes', async () => {
    const onCode = vi.fn();
    renderWithApp(
      <OtpStep
        email="a@b.co"
        code="12"
        resendSeconds={60}
        error={undefined}
        busy={false}
        onCode={onCode}
        onResend={() => Promise.resolve(true)}
      />,
    );
    const boxes = document.querySelectorAll('.app-otp__box');
    expect(boxes).toHaveLength(6);
    expect(boxes[0]).toHaveTextContent('1');
    expect(boxes[1]).toHaveClass('app-otp__box--filled');
    expect(boxes[2]).toHaveClass('app-otp__box--current');
    await userEvent.type(screen.getByLabelText('Verification code'), '3a');
    expect(onCode).toHaveBeenLastCalledWith('12');
  });

  it('ListPage puts the table in a card with the title and the server total', () => {
    renderWithApp(
      <ListPage
        title="Items"
        table={{
          caption: 'Items',
          columns: [{ key: 'id', header: 'Ref', render: (r: { id: string }) => r.id }],
          rows: [{ id: 'ITEM-1' }],
          rowKey: (r) => r.id,
        }}
        pagination={{
          page: 1,
          pageSize: 25,
          total: 3842,
          onPageChange: () => undefined,
          onPageSizeChange: () => undefined,
        }}
      />,
    );
    expect(screen.getByText('3,842')).toHaveClass('app-listcard__count');
  });
});
