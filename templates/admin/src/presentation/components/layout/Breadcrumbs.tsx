import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../core/Icon';

export interface Crumb {
  label: string;
  /** Missing on the current page. */
  to?: string;
}

/** Where the admin is: Module > Sub-page. The last crumb is the current page and is not a link. */
export function Breadcrumbs({ crumbs }: { crumbs: readonly Crumb[] }) {
  const { t } = useTranslation();
  if (crumbs.length < 2) return null;
  return (
    <nav aria-label={t('nav.breadcrumbs')} className="app-breadcrumbs">
      <ol>
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${String(index)}`}>
              {crumb.to && !last ? (
                <Link to={crumb.to}>{crumb.label}</Link>
              ) : (
                <span aria-current={last ? 'page' : undefined}>{crumb.label}</span>
              )}
              {!last ? <Icon name="chevronEnd" size="sm" directional /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
