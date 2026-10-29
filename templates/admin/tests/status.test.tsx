import { readFileSync } from 'node:fs';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  STATUS_KINDS,
  STATUS_TONES,
  UNKNOWN_STATUS_TONE,
  type StatusKind,
} from '@/constants/status';
import { TONE_NAMES } from '@/design/tokens/colors';
import { isKnownStatus, statusValues, toneOf } from '@/domain/shared/status';
import { StatusBadge } from '@/presentation/components/core/StatusBadge';
import { StatusSection } from '@/presentation/pages/design/StatusSection';
import ar from '@/locales/ar';
import en from '@/locales/en';
import { axeViolations } from './helpers/axe';
import { renderWithApp } from './helpers/render';

interface Param {
  name: string;
  schema: { enum?: string[]; items?: { enum?: string[] } };
}
interface Spec {
  paths: Record<string, { get?: { parameters?: Param[] } }>;
}
const spec = JSON.parse(readFileSync('contract/openapi.admin.json', 'utf8')) as Spec;

function queryEnum(path: string, name: string): string[] {
  const param = spec.paths[`/admin/v1${path}`]?.get?.parameters?.find((p) => p.name === name);
  const values = param?.schema.enum ?? param?.schema.items?.enum;
  if (!values) throw new Error(`no enum for ${path} ${name}`);
  return values;
}

/** Enum values straight from the server contract; kinds not in a query filter come from the DTOs. */
const EXPECTED: Record<StatusKind, string[]> = {
  item: queryEnum('/items', 'status'),
  itemOwner: queryEnum('/items', 'ownerType'),
};

const labels = (tree: unknown, kind: string): Record<string, string> =>
  (tree as { status: Record<string, Record<string, string>> }).status[kind] ?? {};

describe('status registry', () => {
  it('covers every kind we expect and nothing else', () => {
    expect([...STATUS_KINDS].sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(STATUS_KINDS)(
    '%s: every enum value has a tone and the registry has no extras',
    (kind) => {
      expect(statusValues(kind).sort()).toEqual([...EXPECTED[kind]].sort());
    },
  );

  it.each(STATUS_KINDS)(
    '%s: every value has a valid tone and a label in both languages',
    (kind) => {
      for (const value of statusValues(kind)) {
        expect(TONE_NAMES).toContain(toneOf(kind, value));
        for (const tree of [en, ar]) {
          expect(labels(tree, kind)[value], `${kind}.${value}`).toBeTruthy();
        }
      }
    },
  );

  it('has no label without a registry entry (no stale translations)', () => {
    for (const tree of [en, ar]) {
      for (const kind of STATUS_KINDS) {
        expect(Object.keys(labels(tree, kind)).sort()).toEqual(statusValues(kind).sort());
      }
      expect(Object.keys((tree as { status: object }).status).sort()).toEqual(
        [...STATUS_KINDS].sort(),
      );
    }
  });

  it('Arabic labels contain Arabic script', () => {
    for (const kind of STATUS_KINDS) {
      for (const label of Object.values(labels(ar, kind))) expect(label).toMatch(/[؀-ۿ]/);
    }
  });

  it('matches the business meaning: failures red, success green, waiting amber', () => {
    expect(STATUS_TONES.item.ACTIVE).toBe('green');
    expect(STATUS_TONES.item.ARCHIVED).toBe('grey');
    expect(STATUS_TONES.itemOwner.CUSTOMER).not.toBe(STATUS_TONES.itemOwner.MERCHANT);
  });
});

describe('domain helpers', () => {
  it('toneOf falls back to the neutral tone for unknown values and kinds', () => {
    expect(toneOf('item', 'SOMETHING_NEW')).toBe(UNKNOWN_STATUS_TONE);
    expect(toneOf('nope' as StatusKind, 'X')).toBe(UNKNOWN_STATUS_TONE);
    expect(isKnownStatus('item', 'ACTIVE')).toBe(true);
    expect(isKnownStatus('item', 'active')).toBe(false);
    expect(statusValues('nope' as StatusKind)).toEqual([]);
  });
});

describe('StatusBadge', () => {
  it('shows the translated label with the registry tone', () => {
    renderWithApp(<StatusBadge kind="item" value="ARCHIVED" />);
    const badge = screen.getByText('Archived');
    expect(badge).toHaveClass('app-badge--grey');
  });

  it('translates to Arabic', () => {
    renderWithApp(<StatusBadge kind="item" value="ARCHIVED" />, undefined, 'ar');
    expect(screen.getByText('مؤرشف')).toBeVisible();
  });

  it('shows an unknown value as it is, in the neutral tone, without throwing', () => {
    renderWithApp(<StatusBadge kind="item" value="FUTURE_STATE" />);
    expect(screen.getByText('FUTURE_STATE')).toHaveClass('app-badge--grey');
  });

  it('gallery section renders every registered status accessibly', async () => {
    renderWithApp(
      <main>
        <StatusSection />
      </main>,
    );
    const total = STATUS_KINDS.reduce((sum, kind) => sum + statusValues(kind).length, 0);
    expect(document.querySelectorAll('.app-badge')).toHaveLength(total);
    expect(await axeViolations()).toEqual([]);
  });
});
