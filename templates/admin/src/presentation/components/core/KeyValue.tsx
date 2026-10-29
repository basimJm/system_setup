import type { ReactNode } from 'react';

export interface KeyValueItem {
  readonly key: string;
  readonly label: string;
  readonly value: ReactNode;
  /** Value is an id, amount or phone number: keep it left-to-right in Arabic. */
  readonly ltr?: boolean;
}

/** Definition list for detail pages ("Phone / Created / Status"). Empty values show the placeholder. */
export function KeyValue({
  items,
  placeholder,
}: {
  items: readonly KeyValueItem[];
  placeholder: string;
}) {
  return (
    <dl className="app-keyvalue">
      {items.map((item) => (
        <div key={item.key} className="app-keyvalue__row">
          <dt>{item.label}</dt>
          <dd dir={item.ltr ? 'ltr' : undefined}>
            {item.value === null || item.value === undefined || item.value === ''
              ? placeholder
              : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
