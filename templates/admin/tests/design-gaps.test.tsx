import { screen, within } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import { formatRelative } from '@/domain/shared/relativeTime';
import { SectionCard } from '@/presentation/components/core/SectionCard';
import { CardGrid } from '@/presentation/components/data/CardGrid';
import { ExportMenu } from '@/presentation/components/data/ExportMenu';
import { SearchField } from '@/presentation/components/form/SearchField';
import { ListPage } from '@/presentation/components/templates/ListPage';
import SettingsPage from '@/presentation/settings/SettingsPage';
import { ITEMS_STRINGS } from '@/locales/lazy/items';
import { useLazyStrings } from '@/presentation/hooks/useLazyStrings';
import en from '@/locales/en';
import { renderWithApp } from './helpers/render';

const NOW = new Date('2026-10-26T12:00:00Z');

describe('formatRelative', () => {
  it('uses minutes under an hour, hours under a day, then days, in the panel language', () => {
    expect(formatRelative('2026-10-26T11:56:00Z', NOW, 'en')).toBe('4 minutes ago');
    expect(formatRelative('2026-10-26T09:00:00Z', NOW, 'en')).toBe('3 hours ago');
    expect(formatRelative('2026-10-23T12:00:00Z', NOW, 'en')).toBe('3 days ago');
    expect(formatRelative('2026-10-26T11:56:00Z', NOW, 'ar')).toMatch(/٤/);
  });

  it('reads a future instant (clock skew) as now', () => {
    expect(formatRelative('2026-10-26T12:05:00Z', NOW, 'en')).toBe('this minute');
  });
});

describe('list card header (design Blocks table card)', () => {
  it('draws the search box and the Export button inside the card header', () => {
    renderWithApp(
      <ListPage
        title="Items"
        search={<SearchField label="Search items" onSearch={() => undefined} />}
        exportMenu={<ExportMenu onExport={() => Promise.resolve()} />}
        table={{ caption: 'Items', columns: [], rows: [], rowKey: () => '' }}
      />,
    );
    const head = document.querySelector<HTMLElement>('.app-listcard__head');
    if (!head) throw new Error('no list card header');
    expect(within(head).getByRole('searchbox', { name: 'Search items' })).toBeInTheDocument();
    expect(within(head).getByRole('button', { name: 'Export' })).toHaveClass('app-cardbtn');
  });

  it('a grid body renders cards, its loading, empty and error states', () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    const grid = (extra: object) => (
      <CardGrid
        caption="Cards"
        rows={rows}
        rowKey={(r) => r.id}
        renderCard={(r) => <article aria-label={r.id}>{r.id}</article>}
        {...extra}
      />
    );
    const view = renderWithApp(grid({}));
    expect(screen.getAllByRole('article')).toHaveLength(2);
    view.unmount();
    const loading = renderWithApp(grid({ loading: true }));
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    loading.unmount();
    const empty = renderWithApp(grid({ rows: [], emptyTitle: 'No cards' }));
    expect(screen.getByText('No cards')).toBeInTheDocument();
    empty.unmount();
    renderWithApp(grid({ error: new Error('x'), onRetry: () => undefined }));
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

describe('section card (design card header bar)', () => {
  it('is a region named by its title, with subtitle, actions and footer', () => {
    renderWithApp(
      <SectionCard
        title="Sign-in rules"
        subtitle="Applies to new sessions"
        actions={<button type="button">Act</button>}
        footer="Saved"
      >
        body
      </SectionCard>,
    );
    const region = screen.getByRole('region', { name: 'Sign-in rules' });
    expect(within(region).getByRole('heading', { level: 2 })).toHaveClass(
      'app-section-card__title',
    );
    expect(within(region).getByText('Applies to new sessions')).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: 'Act' })).toBeInTheDocument();
    expect(within(region).getByText('Saved').tagName).toBe('FOOTER');
  });

  it('settings groups are section cards with the design header', async () => {
    renderWithApp(<SettingsPage />);
    const heading = await screen.findByRole('heading', { name: 'Verification code (OTP)' });
    expect(heading.closest('.app-section-card__head')).not.toBeNull();
  });
});

function LazyProbe() {
  useLazyStrings(ITEMS_STRINGS);
  useLazyStrings(ITEMS_STRINGS);
  const { t, i18n } = useTranslation();
  return <output>{`${t('items.empty')}|${i18n.t('items.empty', { lng: 'ar' })}`}</output>;
}

describe('lazy locale areas', () => {
  it('the item strings are not in the entry bundle languages', () => {
    expect('items' in en).toBe(false);
  });

  it('useLazyStrings adds both languages once, before the first t() call', () => {
    renderWithApp(<LazyProbe />);
    expect(screen.getByRole('status')).toHaveTextContent('No items yet|لا توجد عناصر بعد');
  });
});
