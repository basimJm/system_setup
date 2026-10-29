import { useMemo, useState } from 'react';
import { rowIdOf, SETTING_DEFINITIONS, type SettingDefinition } from '@/domain/settings/registry';
import type { SettingEntry } from '@/domain/settings/settings';
import {
  parseSetting,
  sameSettingValue,
  settingToText,
  type SettingError,
} from '@/domain/settings/validate';

export interface SettingRow {
  id: string;
  def: SettingDefinition;
  entry: SettingEntry;
  /** Saved value and default of this row (a member of the stored object for object settings). */
  saved: unknown;
  fallback: unknown;
  text: string;
  error: SettingError | null;
  changed: boolean;
  /** The text differs from the built-in default, so "use default" does something. */
  canReset: boolean;
}

export interface SettingChange {
  key: string;
  value: unknown;
}

const memberOf = (value: unknown, field: string | undefined): unknown =>
  field ? (value as Record<string, unknown> | null | undefined)?.[field] : value;

function buildRow(
  def: SettingDefinition,
  entry: SettingEntry,
  typed: string | undefined,
): SettingRow {
  const saved = memberOf(entry.value, def.field);
  const fallback = memberOf(entry.default, def.field);
  const text = typed ?? settingToText(saved);
  const parsed = parseSetting(text, def);
  return {
    id: rowIdOf(def),
    def,
    entry,
    saved,
    fallback,
    text,
    error: parsed.ok ? null : parsed.error,
    changed: parsed.ok && !sameSettingValue(parsed.value, saved),
    canReset: !parsed.ok || !sameSettingValue(parsed.value, fallback),
  };
}

/** One change per key: object settings merge their edited members into the stored object. */
function toChanges(rows: readonly SettingRow[]): SettingChange[] {
  const byKey = new Map<string, unknown>();
  for (const r of rows) {
    const parsed = parseSetting(r.text, r.def);
    if (!r.changed || !parsed.ok) continue;
    if (!r.def.field) byKey.set(r.def.key, parsed.value);
    else
      byKey.set(r.def.key, {
        ...((byKey.get(r.def.key) ?? r.entry.value) as Record<string, unknown>),
        [r.def.field]: parsed.value,
      });
  }
  return [...byKey].map(([key, value]) => ({ key, value }));
}

/** What the admin is editing: the typed text per row on top of the saved entries, with validation and the changed set. */
export function useSettingsDraft(entries: readonly SettingEntry[] | undefined) {
  const [typed, setTyped] = useState<Readonly<Record<string, string>>>({});
  const rows = useMemo<SettingRow[]>(() => {
    const byKey = new Map((entries ?? []).map((e) => [e.key, e]));
    return SETTING_DEFINITIONS.flatMap((def) => {
      const entry = byKey.get(def.key);
      return entry ? [buildRow(def, entry, typed[rowIdOf(def)])] : [];
    });
  }, [entries, typed]);
  const changes = useMemo(() => toChanges(rows), [rows]);

  return {
    rows,
    changes,
    hasErrors: rows.some((r) => r.error !== null),
    dirty: changes.length > 0,
    setText: (id: string, text: string) => setTyped((t) => ({ ...t, [id]: text })),
    useDefault: (id: string) =>
      setTyped((t) => ({
        ...t,
        [id]: settingToText(rows.find((r) => r.id === id)?.fallback),
      })),
    discard: () => setTyped({}),
  };
}
