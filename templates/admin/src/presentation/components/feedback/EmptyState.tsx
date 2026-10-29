import type { ReactNode } from 'react';
import type { IconName } from '@/constants/icons';
import { Icon } from '../core/Icon';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: IconName;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon = 'inbox', action }: EmptyStateProps) {
  return (
    <div className="app-state" role="status">
      <Icon name={icon} size="lg" />
      <h2 className="app-state__title">{title}</h2>
      {description ? <p className="app-state__text">{description}</p> : null}
      {action}
    </div>
  );
}
