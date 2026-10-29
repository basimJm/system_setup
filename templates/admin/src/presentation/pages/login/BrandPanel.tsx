import { useTranslation } from 'react-i18next';
import { SESSION_IDLE_DAYS } from '@/constants/session';
import { BRAND_ICON_URL, BRAND_MARK, BRAND_TAGLINE } from '@/constants/ui';
import { formatNumber } from '@/domain/shared/format';
import { Icon } from '../../components/core/Icon';
import { useLanguage } from '../../hooks/useLanguage';

/** Brand side of the login screen (design `01 Login`). Collapses to a slim header on small screens. */
export function BrandPanel() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  return (
    <aside className="app-brand">
      <span className="app-brand__ring app-brand__ring--top" aria-hidden="true" />
      <span className="app-brand__ring app-brand__ring--bottom" aria-hidden="true" />
      <div className="app-brand__top">
        <img className="app-brand__icon" src={BRAND_ICON_URL} alt={BRAND_MARK} />
        <div className="app-brand__names">
          <div className="app-brand__wordmark">
            <span className="app-brand__mark">{BRAND_MARK}</span>
            <span className="app-brand__tagline" dir="ltr">
              {BRAND_TAGLINE}
            </span>
          </div>
          <span className="app-brand__admin">{t('login.brand.chip')}</span>
        </div>
      </div>
      <div className="app-brand__copy">
        <h2 className="app-brand__headline">{t('login.brand.headline')}</h2>
        <p className="app-brand__text">{t('login.brand.text')}</p>
      </div>
      <p className="app-brand__security">
        <Icon name="shield" size="sm" />
        {t('login.brand.security', { days: formatNumber(SESSION_IDLE_DAYS, language) })}
      </p>
    </aside>
  );
}
