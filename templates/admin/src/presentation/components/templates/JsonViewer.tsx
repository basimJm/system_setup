import { useTranslation } from 'react-i18next';
import { JSON_MAX_DEPTH, JSON_OPEN_DEPTH } from '@/constants/ui';

export interface JsonViewerProps {
  value: unknown;
  /** Accessible name of the viewer (e.g. "Before"). */
  label: string;
}

const isContainer = (v: unknown): v is Record<string, unknown> | unknown[] =>
  typeof v === 'object' && v !== null;

function Leaf({ value }: { value: unknown }) {
  if (value === null) return <span className="app-json__null">{String(value)}</span>;
  if (typeof value === 'string')
    return <span className="app-json__string">&quot;{value}&quot;</span>;
  if (typeof value === 'number' || typeof value === 'boolean')
    return <span className="app-json__scalar">{String(value)}</span>;
  return <span className="app-json__scalar">{typeof value}</span>;
}

function Node({ name, value, depth }: { name?: string; value: unknown; depth: number }) {
  const { t } = useTranslation();
  const label = name === undefined ? null : <span className="app-json__key">{name}: </span>;
  if (!isContainer(value)) {
    return (
      <div className="app-json__row" dir="ltr">
        {label}
        <Leaf value={value} />
      </div>
    );
  }
  if (depth >= JSON_MAX_DEPTH) {
    return (
      <div className="app-json__row" dir="ltr">
        {label}…
      </div>
    );
  }
  const entries = Array.isArray(value)
    ? value.map((item, index): [string, unknown] => [String(index), item])
    : Object.entries(value);
  const summary = Array.isArray(value)
    ? t('json.items', { count: entries.length })
    : t('json.fields', { count: entries.length });
  return (
    <details className="app-json__node" open={depth < JSON_OPEN_DEPTH} dir="ltr">
      <summary>
        {label}
        <span className="app-json__summary">{summary}</span>
      </summary>
      <div className="app-json__children">
        {entries.map(([key, child]) => (
          <Node key={key} name={key} value={child} depth={depth + 1} />
        ))}
      </div>
    </details>
  );
}

/** Read-only, collapsible view of a JSON value (audit before/after, event params). Always left-to-right. */
export function JsonViewer({ value, label }: JsonViewerProps) {
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region must be keyboard reachable
    <div className="app-json" role="region" aria-label={label} tabIndex={0}>
      <Node value={value} depth={0} />
    </div>
  );
}
