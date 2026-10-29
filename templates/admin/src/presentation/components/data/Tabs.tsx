import { useId, type ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

export interface TabsProps {
  items: readonly TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}

export function Tabs({ items, activeId, onChange, ariaLabel }: TabsProps) {
  const base = useId();
  const active = items.find((i) => i.id === activeId) ?? items[0];
  return (
    <div className="app-tabs">
      <div role="tablist" aria-label={ariaLabel} className="app-tabs__list">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${base}-tab-${item.id}`}
            aria-selected={item.id === active?.id}
            aria-controls={`${base}-panel-${item.id}`}
            tabIndex={item.id === active?.id ? 0 : -1}
            className="app-tabs__tab"
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {active ? (
        <div
          role="tabpanel"
          id={`${base}-panel-${active.id}`}
          aria-labelledby={`${base}-tab-${active.id}`}
        >
          {active.content}
        </div>
      ) : null}
    </div>
  );
}
