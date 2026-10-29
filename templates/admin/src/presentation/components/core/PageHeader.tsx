import type { ReactNode } from 'react';

/** Design `head` block: serif title with optional badges (live pill, status), subtitle, actions at the end. */
export function PageHeader({
  title,
  subtitle,
  actions,
  badges,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Shown next to the title (e.g. the realtime "Live" pill). */
  badges?: ReactNode;
}) {
  return (
    <header className="app-pageheader">
      <div className="app-pageheader__text">
        <div className="app-pageheader__titlerow">
          <h1 className="app-pageheader__title">{title}</h1>
          {badges}
        </div>
        {subtitle ? <p className="app-pageheader__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="app-pageheader__actions">{actions}</div> : null}
    </header>
  );
}
