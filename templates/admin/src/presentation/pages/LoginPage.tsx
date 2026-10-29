import { useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { OTP_LENGTH } from '@/constants/auth';
import { SESSION_IDLE_DAYS } from '@/constants/session';
import { formatNumber } from '@/domain/shared/numbers';
import { HOME_ROUTE, LOGIN_REDIRECT_PARAM } from '@/constants/routes';
import { useContainer } from '@/app/ContainerContext';
import { Button } from '../components/core/Button';
import { Icon } from '../components/core/Icon';
import { InlineAlert } from '../components/feedback/InlineAlert';
import { safeRedirect } from '../controllers/loginValidation';
import { useLoginController } from '../controllers/useLoginController';
import { useLanguage } from '../hooks/useLanguage';
import { PreferenceSwitches } from '../layout/PreferenceSwitches';
import { BrandPanel } from './login/BrandPanel';
import { CredentialsStep } from './login/CredentialsStep';
import { OtpStep } from './login/OtpStep';

/** A00 — email + password, then the emailed one-time code. Language and theme can be changed here. */
export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ctrl = useLoginController();
  const ended = useContainer().session.endReason();
  const { language } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const fieldError = (key: string | undefined) =>
    key ? t(key, { length: OTP_LENGTH }) : undefined;
  const first = ctrl.step === 'credentials';

  const onSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (first) {
      await ctrl.submitCredentials(email, password);
    } else if (await ctrl.submitCode(code)) {
      void navigate(safeRedirect(params.get(LOGIN_REDIRECT_PARAM), HOME_ROUTE), {
        replace: true,
      });
    }
  };

  return (
    <div className="app-login">
      <BrandPanel />
      <main className="app-login__main">
        <div className="app-login__prefs">
          <PreferenceSwitches />
        </div>
        <section className="app-login__card" aria-labelledby="login-title">
          {first ? null : (
            <button type="button" className="app-login__back" onClick={ctrl.back}>
              <Icon name="chevronEnd" size="sm" directional />
              {t('common.back')}
            </button>
          )}
          <div className="app-login__heading">
            <h1 id="login-title" className="app-login__title">
              {t(first ? 'login.title' : 'login.codeTitle')}
            </h1>
            {first ? <p className="app-login__lead">{t('login.subtitle')}</p> : null}
          </div>
          {first && ended ? (
            <p className="app-login__notice" role="status">
              {t(`login.ended.${ended}`, { days: formatNumber(SESSION_IDLE_DAYS, language) })}
            </p>
          ) : null}
          <form className="app-login__form" onSubmit={(e) => void onSubmit(e)} noValidate>
            {first ? (
              <CredentialsStep
                email={email}
                password={password}
                emailError={fieldError(ctrl.fieldErrors.email)}
                passwordError={fieldError(ctrl.fieldErrors.password)}
                onEmail={setEmail}
                onPassword={setPassword}
              />
            ) : (
              <OtpStep
                email={ctrl.email}
                code={code}
                error={fieldError(ctrl.fieldErrors.code)}
                busy={ctrl.busy}
                onCode={setCode}
                resendSeconds={ctrl.resendSeconds}
                onResend={ctrl.resend}
              />
            )}
            {ctrl.error ? <InlineAlert error={ctrl.error} /> : null}
            <Button type="submit" block loading={ctrl.busy}>
              {t(first ? 'login.continue' : 'login.verify')}
            </Button>
          </form>
        </section>
      </main>
    </div>
  );
}
