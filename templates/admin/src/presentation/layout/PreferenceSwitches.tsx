import { useTranslation } from 'react-i18next';
import { LANGUAGE_NAMES, LANGUAGES } from '@/constants/i18n';
import { useTheme } from '@/design/theme/useTheme';
import { THEME_MODES, type ThemeMode } from '@/design/theme/themeMode';
import type { IconName } from '@/constants/icons';
import { SegmentedControl } from '../components/form/SegmentedControl';
import { useLanguage } from '../hooks/useLanguage';

const THEME_ICONS: Readonly<Record<ThemeMode, IconName>> = {
  light: 'sun',
  dark: 'moon',
  system: 'monitor',
};

/** Language and theme pickers, usable before sign-in (login) and anywhere else. Both persist. */
export function PreferenceSwitches() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const { mode, setMode } = useTheme();
  return (
    <div className="app-prefs">
      <SegmentedControl
        ariaLabel={t('prefs.language')}
        value={language}
        onChange={setLanguage}
        options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] }))}
      />
      <SegmentedControl
        iconOnly
        ariaLabel={t('prefs.theme')}
        value={mode}
        onChange={setMode}
        options={THEME_MODES.map((m) => ({
          value: m,
          label: t(`prefs.${m}`),
          icon: THEME_ICONS[m],
        }))}
      />
    </div>
  );
}
