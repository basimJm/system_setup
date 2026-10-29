import type { ReactNode } from 'react';
import type { IconName } from '@/constants/icons';
import { EmptyState } from './EmptyState';

export interface StatusPageProps {
  /** HTTP-like code shown as a small label ("403"). */
  code: string;
  title: string;
  text: string;
  icon?: IconName;
  action?: ReactNode;
}

/** Full-page notice for 403 / 404 / 500: same layout for all three. */
export function StatusPage({ code, title, text, icon = 'alert', action }: StatusPageProps) {
  return (
    <div className="app-statuspage">
      <p className="app-statuspage__code" aria-hidden="true">
        {code}
      </p>
      <EmptyState title={title} description={text} icon={icon} action={action} />
    </div>
  );
}
