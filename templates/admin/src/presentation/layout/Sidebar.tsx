import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NAV_ITEMS, type NavItem } from '@/constants/nav';
import { BRAND_ICON_URL, BRAND_MARK, BRAND_TAGLINE, SIDEBAR_DRAWER_ID } from '@/constants/ui';
import { formatNumber } from '@/domain/shared/numbers';
import { MAX_COUNTER } from '@/constants/ui';
import { useLanguage } from '../hooks/useLanguage';
import { cx } from '../utils/cx';
import { Icon } from '../components/core/Icon';
import { AdminAvatar } from './AdminAvatar';

export interface SidebarAdmin {
  name: string;
  email: string;
}

export interface SidebarProps {
  mode: 'docked' | 'drawer';
  collapsed: boolean;
  open: boolean;
  onNavigate: () => void;
  /** Number to show next to a module or sub-page, by nav id (new applications, open alerts...). Filled by live data. */
  counters?: Readonly<Record<string, number>>;
  /** Signed-in admin shown at the bottom (design: avatar, name, email). */
  admin?: SidebarAdmin;
  /** Docked sidebar only: the "Collapse" button at the bottom. */
  onToggleCollapse?: () => void;
}

function Counter({ value }: { value: number | undefined }) {
  const { language } = useLanguage();
  if (!value || value <= 0) return null;
  const text =
    value > MAX_COUNTER ? `${formatNumber(MAX_COUNTER, language)}+` : formatNumber(value, language);
  return <span className="app-navitem__count">{text}</span>;
}

interface GroupProps {
  item: NavItem;
  shrink: boolean;
  counters: Readonly<Record<string, number>>;
  onNavigate: () => void;
}

/** A module with sub-pages: the row opens and closes the sub-menu (open while one of its pages is current). */
function NavGroup({ item, shrink, counters, onNavigate }: GroupProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const children = item.children ?? [];
  const inside = children.some((c) => pathname === c.path) || pathname === item.path;
  const [manual, setManual] = useState<boolean | null>(null);
  const expanded = !shrink && (manual ?? inside);
  const total = children.reduce((sum, c) => sum + (counters[c.id] ?? 0), counters[item.id] ?? 0);
  const name = t(item.labelKey);
  const headClass = cx(
    'app-navitem',
    'app-navgroup__head',
    inside && 'app-navgroup__head--inside',
    inside && !expanded && 'app-navgroup__head--closed',
  );
  if (shrink) {
    // Collapsed rail: the icon goes to the module's first page, like the design.
    return (
      <NavLink to={item.path} end onClick={onNavigate} className={headClass} title={name}>
        <Icon name={item.icon} />
        <span className="app-sr-only">{name}</span>
        <Counter value={total} />
      </NavLink>
    );
  }
  return (
    <div className="app-navgroup">
      <button
        type="button"
        className={headClass}
        aria-expanded={expanded}
        aria-label={t(expanded ? 'nav.collapse' : 'nav.expand', { name })}
        onClick={() => setManual(!expanded)}
      >
        <Icon name={item.icon} />
        <span className="app-navitem__label">{name}</span>
        {!expanded ? <Counter value={total} /> : null}
        <span className="app-navgroup__chevron" aria-hidden="true">
          <Icon name="chevronDown" size="sm" />
        </span>
      </button>
      {expanded ? (
        <ul className="app-navgroup__list">
          {children.map((child) => (
            <li key={child.id}>
              <NavLink
                to={child.path}
                end
                onClick={onNavigate}
                className={({ isActive }) => cx('app-navsub', isActive && 'app-navsub--active')}
              >
                <span className="app-navsub__dot" aria-hidden="true" />
                <span className="app-navitem__label">{t(child.labelKey)}</span>
                <Counter value={counters[child.id]} />
              </NavLink>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SidebarFooter({
  admin,
  shrink,
  onToggleCollapse,
}: Pick<SidebarProps, 'admin' | 'onToggleCollapse'> & { shrink: boolean }) {
  const { t } = useTranslation();
  if (!admin && !onToggleCollapse) return null;
  return (
    <div className="app-sidebar__footer">
      {admin && !shrink ? (
        <div className="app-sidebar__admin">
          <AdminAvatar name={admin.name} />
          <div className="app-sidebar__admin-text">
            <span className="app-sidebar__admin-name">{admin.name}</span>
            <span className="app-sidebar__admin-email" dir="ltr">
              {admin.email}
            </span>
          </div>
        </div>
      ) : null}
      {onToggleCollapse ? (
        <button
          type="button"
          className="app-sidebar__collapse"
          aria-expanded={!shrink}
          aria-controls={SIDEBAR_DRAWER_ID}
          title={shrink ? t('nav.expandSidebar') : undefined}
          onClick={onToggleCollapse}
        >
          <span
            className={cx(
              'app-sidebar__collapse-icon',
              shrink && 'app-sidebar__collapse-icon--flip',
            )}
          >
            <Icon name="collapse" size="sm" directional />
          </span>
          {shrink ? (
            <span className="app-sr-only">{t('nav.expandSidebar')}</span>
          ) : (
            <span>{t('nav.collapseSidebar')}</span>
          )}
        </button>
      ) : null}
    </div>
  );
}

export function Sidebar({
  mode,
  collapsed,
  open,
  onNavigate,
  counters = {},
  admin,
  onToggleCollapse,
}: SidebarProps) {
  const { t } = useTranslation();
  const shrink = mode === 'docked' && collapsed;
  return (
    <aside
      id={SIDEBAR_DRAWER_ID}
      className={cx(
        'app-sidebar',
        `app-sidebar--${mode}`,
        shrink && 'app-sidebar--collapsed',
        open && 'app-sidebar--open',
      )}
      aria-label={t('nav.label')}
      // A closed drawer is off-canvas: keep it out of the tab order and the accessibility tree.
      inert={mode === 'drawer' && !open}
    >
      <div className="app-sidebar__brand">
        <img className="app-sidebar__icon" src={BRAND_ICON_URL} alt={BRAND_MARK} />
        {!shrink ? (
          <div className="app-sidebar__names">
            <div className="app-sidebar__wordmark">
              <span className="app-sidebar__mark">{BRAND_MARK}</span>
              <span className="app-sidebar__tagline" dir="ltr">
                {BRAND_TAGLINE}
              </span>
            </div>
            <span className="app-sidebar__chip">{t('app.adminLabel')}</span>
          </div>
        ) : null}
      </div>
      <nav className="app-sidebar__nav">
        {NAV_ITEMS.map((item) =>
          item.children ? (
            <NavGroup
              key={item.id}
              item={item}
              shrink={shrink}
              counters={counters}
              onNavigate={onNavigate}
            />
          ) : (
            <NavLink
              key={item.id}
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) => cx('app-navitem', isActive && 'app-navitem--active')}
              title={shrink ? t(item.labelKey) : undefined}
            >
              <Icon name={item.icon} />
              <span className={shrink ? 'app-sr-only' : 'app-navitem__label'}>
                {t(item.labelKey)}
              </span>
              <Counter value={counters[item.id]} />
            </NavLink>
          ),
        )}
      </nav>
      <SidebarFooter
        shrink={shrink}
        {...(admin ? { admin } : {})}
        {...(onToggleCollapse ? { onToggleCollapse } : {})}
      />
    </aside>
  );
}
