import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { OTP_LENGTH, OTP_VALID_MINUTES } from '@/constants/auth';
import { Button } from '../../components/core/Button';
import { maskEmail } from '../../controllers/maskEmail';
import { formatClock, useCountdown } from '../../hooks/useCountdown';
import { cx } from '../../utils/cx';

export interface OtpStepProps {
  email: string;
  code: string;
  /** Wait before another code can be requested (server value). */
  resendSeconds: number;
  error: string | undefined;
  busy: boolean;
  onCode: (value: string) => void;
  onResend: () => Promise<boolean>;
}

/** Design `01 Login` code boxes, drawn over one real input (autofill, paste and screen readers keep working). */
function OtpBoxes({ code, error, onCode }: Pick<OtpStepProps, 'code' | 'error' | 'onCode'>) {
  const { t } = useTranslation();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // The user just pressed Continue: move focus to the code field.
  useEffect(() => inputRef.current?.focus(), []);
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => code[i] ?? '');
  return (
    <div className={cx('app-field', error && 'app-field--error')}>
      <label className="app-sr-only" htmlFor={id}>
        {t('login.code')}
      </label>
      <div className="app-otp">
        {digits.map((digit, i) => (
          <span
            // Fixed number of positional boxes: the position is the identity.
            key={`box-${String(i)}`}
            aria-hidden="true"
            className={cx(
              'app-otp__box',
              digit !== '' && 'app-otp__box--filled',
              i === Math.min(code.length, OTP_LENGTH - 1) && 'app-otp__box--current',
            )}
          >
            {digit}
          </span>
        ))}
        <input
          id={id}
          ref={inputRef}
          className="app-field__control app-otp__input"
          inputMode="numeric"
          autoComplete="one-time-code"
          dir="ltr"
          maxLength={OTP_LENGTH}
          value={code}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onCode(e.target.value.replace(/\D/g, ''))}
        />
      </div>
      {error ? (
        <span id={`${id}-error`} className="app-field__error app-otp__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** Second login step. Mounted only on this step, so the resend timer starts when the code was sent. */
export function OtpStep({
  email,
  code,
  resendSeconds,
  error,
  busy,
  onCode,
  onResend,
}: OtpStepProps) {
  const { t } = useTranslation();
  const { remaining, restart } = useCountdown(resendSeconds);
  const resend = async () => {
    if (await onResend()) restart();
  };
  return (
    <>
      <p className="app-login__lead">
        {t('login.codeSubtitle', { length: OTP_LENGTH, minutes: OTP_VALID_MINUTES })}{' '}
        <bdi className="app-login__email">{maskEmail(email)}</bdi>
      </p>
      <OtpBoxes code={code} error={error} onCode={onCode} />
      <div className="app-login__resend">
        <span>{t('login.noCode')}</span>
        {remaining > 0 ? (
          <span aria-live="polite" dir="ltr">
            {t('login.resendIn', { time: formatClock(remaining) })}
          </span>
        ) : (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void resend()}>
            {t('login.resend')}
          </Button>
        )}
      </div>
    </>
  );
}
