import { useId, type ReactNode } from 'react';
import { cx } from '../../utils/cx';

export interface SectionCardProps {
  title: string;
  subtitle?: string;
  /** Buttons or badges at the end of the header row. */
  actions?: ReactNode;
  /** Footer row under a hairline (save bar, note). */
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Design `Blocks` card with a header: bold title (+ muted line) on a bar ruled off from the body, optional footer.
 * Settings groups, analytics cards and any titled form section use it.
 */
export function SectionCard({
  title,
  subtitle,
  actions,
  footer,
  className,
  children,
}: SectionCardProps) {
  const titleId = useId();
  return (
    <section className={cx('app-card app-section-card', className)} aria-labelledby={titleId}>
      <header className="app-section-card__head">
        <div className="app-section-card__titles">
          <h2 id={titleId} className="app-section-card__title">
            {title}
          </h2>
          {subtitle ? <p className="app-section-card__sub">{subtitle}</p> : null}
        </div>
        {actions ? <div className="app-section-card__actions">{actions}</div> : null}
      </header>
      <div className="app-section-card__body">{children}</div>
      {footer ? <footer className="app-section-card__foot">{footer}</footer> : null}
    </section>
  );
}
