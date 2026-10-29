import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Avatar } from '@/presentation/components/core/Avatar';
import { Chip } from '@/presentation/components/core/Chip';
import { Divider } from '@/presentation/components/core/Divider';
import { Heading } from '@/presentation/components/core/Heading';
import { KeyValue } from '@/presentation/components/core/KeyValue';
import { Link } from '@/presentation/components/core/Link';
import { Text } from '@/presentation/components/core/Text';
import { Tooltip } from '@/presentation/components/core/Tooltip';
import { initialsOf } from '@/presentation/utils/initials';
import { isSafeExternalHref } from '@/presentation/utils/safeHref';
import { axeViolations } from './helpers/axe';

describe('initialsOf', () => {
  it.each([
    ['Layth Al-Hasan', 'LA'],
    ['layth', 'L'],
    ['ليث الحسن', 'لا'],
    ['  Dana   Saleh  Extra ', 'DS'],
    ['', ''],
    ['😀 Smile', '😀S'],
  ])('%j -> %j', (name, expected) => expect(initialsOf(name)).toBe(expected));
});

describe('isSafeExternalHref', () => {
  it.each([
    ['https://example.com', true],
    ['http://example.com', true],
    ['mailto:a@b.co', true],
    ['tel:+96279', true],
    ['javascript:alert(1)', false],
    ['data:text/html,x', false],
    ['/relative', false],
    ['', false],
  ])('%s -> %s', (href, safe) => expect(isSafeExternalHref(href)).toBe(safe));
});

describe('primitives', () => {
  it('Text applies tone, size, strength and left-to-right isolation', () => {
    render(
      <Text as="span" tone="danger" size="md" strong ltr>
        +962
      </Text>,
    );
    const el = screen.getByText('+962');
    expect(el.tagName).toBe('SPAN');
    expect(el).toHaveClass('app-text--danger', 'app-text--md', 'app-text--strong');
    expect(el).toHaveAttribute('dir', 'ltr');
  });

  it('Heading keeps semantic level apart from look', () => {
    render(
      <Heading level={3} look={1}>
        Title
      </Heading>,
    );
    const el = screen.getByRole('heading', { level: 3 });
    expect(el).toHaveClass('app-heading--1');
  });

  it('Link routes inside the app and hardens external links; unsafe links become text', () => {
    render(
      <MemoryRouter>
        <Link to="/items">Items</Link>
        <Link href="https://example.com">Docs</Link>
        <Link href="javascript:alert(1)">Bad</Link>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Items' })).toHaveAttribute('href', '/items');
    const ext = screen.getByRole('link', { name: 'Docs' });
    expect(ext).toHaveAttribute('target', '_blank');
    expect(ext).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByRole('link', { name: 'Bad' })).toBeNull();
    expect(screen.getByText('Bad').tagName).toBe('SPAN');
  });

  it('Divider supports both orientations', () => {
    const { container, rerender } = render(<Divider />);
    expect(container.querySelector('hr')).not.toHaveAttribute('aria-orientation');
    rerender(<Divider vertical />);
    expect(container.querySelector('hr')).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('Avatar names itself and shows initials or a picture', () => {
    const { rerender } = render(<Avatar name="Layth Al-Hasan" />);
    expect(screen.getByRole('img', { name: 'Layth Al-Hasan' })).toHaveTextContent('LA');
    rerender(<Avatar name="Layth Al-Hasan" src="x.png" size="lg" />);
    expect(document.querySelector('img')).toHaveAttribute('src', 'x.png');
    expect(screen.getByRole('img', { name: 'Layth Al-Hasan' })).toHaveClass('app-avatar--lg');
  });

  it('Avatar falls back to initials when the picture fails, and retries a new picture', () => {
    const { rerender } = render(<Avatar name="Sara Ali" src="broken.png" />);
    fireEvent.error(document.querySelector('img') as HTMLImageElement);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByRole('img', { name: 'Sara Ali' })).toHaveTextContent('SA');
    rerender(<Avatar name="Sara Ali" src="fixed.png" />);
    expect(document.querySelector('img')).toHaveAttribute('src', 'fixed.png');
  });

  it('Chip is static, or removable with an accessible button', async () => {
    const onRemove = vi.fn();
    const { rerender } = render(<Chip>Amman</Chip>);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(
      <Chip onRemove={onRemove} removeLabel="Remove Amman">
        Amman
      </Chip>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove Amman' }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('Tooltip appears on hover and focus, hides on leave and Escape, and describes the control', async () => {
    const user = userEvent.setup();
    render(<Tooltip content="Help">{(aria) => <button {...aria}>Trigger</button>}</Tooltip>);
    const button = screen.getByRole('button', { name: 'Trigger' });
    const tip = document.querySelector('[role="tooltip"]');
    expect(button).toHaveAccessibleDescription('Help');
    expect(tip).toHaveAttribute('hidden');
    await user.hover(button);
    expect(tip).not.toHaveAttribute('hidden');
    await user.unhover(button);
    expect(tip).toHaveAttribute('hidden');
    await user.tab();
    expect(tip).not.toHaveAttribute('hidden');
    await user.keyboard('{Escape}');
    expect(tip).toHaveAttribute('hidden');
  });

  it('KeyValue shows placeholders for empty values and isolates ltr values', () => {
    render(
      <KeyValue
        placeholder="Not set"
        items={[
          { key: 'a', label: 'Phone', value: '+962', ltr: true },
          { key: 'b', label: 'Created', value: '' },
          { key: 'c', label: 'Other', value: null },
        ]}
      />,
    );
    expect(screen.getByText('+962')).toHaveAttribute('dir', 'ltr');
    expect(screen.getAllByText('Not set')).toHaveLength(2);
  });

  it('has no accessibility violations', async () => {
    render(
      <MemoryRouter>
        <main>
          <Heading level={1}>Title</Heading>
          <Text>Body</Text>
          <Link to="/x">Link</Link>
          <Avatar name="Dana Saleh" />
          <Chip onRemove={() => undefined} removeLabel="Remove">
            A
          </Chip>
          <Tooltip content="Help">{(aria) => <button {...aria}>T</button>}</Tooltip>
          <KeyValue placeholder="-" items={[{ key: 'k', label: 'Label', value: 'V' }]} />
        </main>
      </MemoryRouter>,
    );
    expect(await axeViolations()).toEqual([]);
  });
});
