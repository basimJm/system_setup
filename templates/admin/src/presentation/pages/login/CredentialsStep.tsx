import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '../../components/core/IconButton';
import { TextField } from '../../components/form/TextField';

export interface CredentialsStepProps {
  email: string;
  password: string;
  emailError: string | undefined;
  passwordError: string | undefined;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
}

export function CredentialsStep({
  email,
  password,
  emailError,
  passwordError,
  onEmail,
  onPassword,
}: CredentialsStepProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <>
      <TextField
        label={t('login.email')}
        type="email"
        autoComplete="username"
        startIcon="mail"
        dir="ltr"
        value={email}
        onChange={(e) => onEmail(e.target.value)}
        error={emailError}
      />
      <TextField
        label={t('login.password')}
        type={visible ? 'text' : 'password'}
        autoComplete="current-password"
        startIcon="lock"
        dir="ltr"
        value={password}
        onChange={(e) => onPassword(e.target.value)}
        error={passwordError}
        endSlot={
          <IconButton
            icon={visible ? 'eyeOff' : 'eye'}
            label={t(visible ? 'login.hidePassword' : 'login.showPassword')}
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
          />
        }
      />
    </>
  );
}
