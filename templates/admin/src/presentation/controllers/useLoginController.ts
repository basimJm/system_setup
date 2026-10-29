import { useState } from 'react';
import { RESEND_SECONDS } from '@/constants/auth';
import type { LoginChallenge } from '@/domain/auth/auth';
import { useContainer } from '@/app/ContainerContext';
import { normalizeError } from '@/infrastructure/errors/normalize';
import type { AppError } from '@/infrastructure/errors/AppError';
import { validateCode, validateCredentials, type FieldErrors } from './loginValidation';

export type LoginStep = 'credentials' | 'code';

export interface LoginController {
  step: LoginStep;
  email: string;
  /** Seconds before another code can be asked for (from the server). */
  resendSeconds: number;
  busy: boolean;
  fieldErrors: FieldErrors;
  error: AppError | null;
  submitCredentials: (email: string, password: string) => Promise<void>;
  submitCode: (code: string) => Promise<boolean>;
  resend: () => Promise<boolean>;
  back: () => void;
}

/** Controller for the two-step admin login (email+password, then email OTP). */
export function useLoginController(): LoginController {
  const { repositories, session, logger } = useContainer();
  const [step, setStep] = useState<LoginStep>('credentials');
  // The password stays in memory only while the code step is open: asking for a new code repeats step 1.
  const [password, setPassword] = useState('');
  const [resendSeconds, setResendSeconds] = useState(RESEND_SECONDS);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<AppError | null>(null);

  const run = async <T>(work: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await work();
    } catch (e) {
      const appError = normalizeError(e);
      logger.warn('login.failed', { kind: appError.kind, traceId: appError.traceId });
      setError(appError);
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  return {
    step,
    email,
    resendSeconds,
    busy,
    fieldErrors,
    error,
    async submitCredentials(emailInput, passwordInput) {
      const errors = validateCredentials(emailInput, passwordInput);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) return;
      const challenge = await run(() => repositories.auth.login(emailInput.trim(), passwordInput));
      if (!challenge) return;
      setEmail(emailInput.trim());
      setPassword(passwordInput);
      setResendSeconds(challenge.resendAfterSeconds);
      setStep('code');
    },
    async submitCode(code) {
      const errors = validateCode(code);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) return false;
      const result = await run(() => repositories.auth.verifyOtp(email, code));
      if (!result) return false;
      setPassword('');
      session.set({ ...result, admin: { ...result.admin, email: result.admin.email || email } });
      return true;
    },
    async resend() {
      const challenge: LoginChallenge | undefined = await run(() =>
        repositories.auth.login(email, password),
      );
      if (!challenge) return false;
      setResendSeconds(challenge.resendAfterSeconds);
      return true;
    },
    back() {
      setStep('credentials');
      setPassword('');
      setFieldErrors({});
      setError(null);
    },
  };
}
