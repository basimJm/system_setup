import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { Menu } from '../components/overlay/Menu';
import { Icon } from '../components/core/Icon';
import { IconButton } from '../components/core/IconButton';
import { useTheme } from '@/design/theme/useTheme';
import { useLanguage } from '../hooks/useLanguage';
import { AdminAvatar } from './AdminAvatar';

export interface TopbarProps {
  adminName: string;
  /** Shown under the name in the admin menu. */
  adminEmail?: string;
  showMenuButton: boolean;
  menuLabelKey: string;
  menuExpanded: boolean;
  onMenu: () => void;
  onLogout: () => void;
}

/** Design `Admin Topbar`: language, theme and the admin menu. */
export function Topbar({
  adminName,
  adminEmail,
  showMenuButton,
  menuLabelKey,
  menuExpanded,
  onMenu,
  onLogout,
}: TopbarProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { theme, toggle: toggleTheme } = useTheme();
  const { toggle: toggleLanguage } = useLanguage();
  const name = adminName || t('topbar.adminMenu');
  return (
    <header className="app-topbar">
      {showMenuButton ? (
        <IconButton
          icon="menu"
          label={t(menuLabelKey)}
          aria-expanded={menuExpanded}
          onClick={onMenu}
        />
      ) : null}
      <span className="app-topbar__spacer" />
      <button
        type="button"
        className="app-topbtn app-topbtn--text"
        aria-label={t('topbar.language')}
        title={t('topbar.language')}
        onClick={toggleLanguage}
      >
        {t('topbar.otherLanguageShort')}
      </button>
      <IconButton
        className="app-topbtn"
        icon={theme === 'dark' ? 'sun' : 'moon'}
        label={t(theme === 'dark' ? 'topbar.lightTheme' : 'topbar.darkTheme')}
        onClick={toggleTheme}
      />
      <Menu
        label={name}
        triggerClassName="app-topbar__admin"
        trigger={
          <>
            <AdminAvatar name={name} small />
            <span className="app-topbar__admin-name">{name}</span>
            <Icon name="chevronDown" size="sm" />
          </>
        }
        header={
          <>
            <span className="app-menu__header-name">{name}</span>
            {adminEmail ? (
              <span className="app-menu__header-email" dir="ltr">
                {adminEmail}
              </span>
            ) : null}
          </>
        }
        items={[
          { key: 'about', label: t('topbar.about'), onSelect: () => void navigate(ROUTES.about) },
          { key: 'logout', label: t('topbar.logout'), onSelect: onLogout, danger: true },
        ]}
      />
    </header>
  );
}
