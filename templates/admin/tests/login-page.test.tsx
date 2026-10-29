import { act, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MIN_PASSWORD_LENGTH, OTP_LENGTH, RESEND_SECONDS } from '@/constants/auth';
import { LANGUAGE_NAMES } from '@/constants/i18n';
import { ROUTES } from '@/constants/routes';
import { STORAGE_KEYS } from '@/constants/storage';
import { MockAuthRepository } from '@/data/auth/MockAuthRepository';
import { AppError } from '@/infrastructure/errors/AppError';
import { maskEmail } from '@/presentation/controllers/maskEmail';
import { formatClock, useCountdown } from '@/presentation/hooks/useCountdown';
import ar from '@/locales/ar';
import en from '@/locales/en';
import { App } from '@/app/App';
import { makeContainer, renderRoutes, renderWithApp } from './helpers/render';

const PASSWORD = 'p'.repeat(MIN_PASSWORD_LENGTH);
const EMAIL = 'admin@example.test';

/** The timer re-arms after each render, so advance one second per act(). */
async function tick(seconds: number): Promise<void> {
  for (let i = 0; i < seconds; i += 1) await act(() => vi.advanceTimersByTimeAsync(1000));
}

describe('maskEmail / formatClock', () => {
  it.each([
    ['admin@example.test', 'a•••n@example.test'],
    ['ab@example.test', 'a•••@example.test'],
    ['a@example.test', 'a•••@example.test'],
    ['not-an-email', 'not-an-email'],
    ['@example.test', '@example.test'],
  ])('%s -> %s', (input, expected) => expect(maskEmail(input)).toBe(expected));

  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [60, '1:00'],
    [75, '1:15'],
  ])('%s s -> %s', (s, text) => expect(formatClock(s)).toBe(text));
});

describe('useCountdown', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('counts down each second, stops at 0, and restarts', async () => {
    const { result } = renderHook(() => useCountdown(3));
    expect(result.current.remaining).toBe(3);
    await tick(2);
    expect(result.current.remaining).toBe(1);
    await tick(5);
    expect(result.current.remaining).toBe(0);
    act(() => result.current.restart());
    expect(result.current.remaining).toBe(3);
  });
});

describe('language and theme on the login page', () => {
  it('shows both languages and switches direction, text and storage', async () => {
    renderRoutes(ROUTES.login, { language: 'ar' });
    expect(await screen.findByRole('heading', { name: ar.login.title })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');

    const group = screen.getByRole('radiogroup', { name: ar.prefs.language });
    expect(group).toHaveTextContent(LANGUAGE_NAMES.ar);
    await userEvent.click(screen.getByRole('radio', { name: LANGUAGE_NAMES.en }));
    expect(await screen.findByRole('heading', { name: en.login.title })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    expect(window.localStorage.getItem(STORAGE_KEYS.language)).toBe('en');
    expect(screen.getByRole('radio', { name: LANGUAGE_NAMES.en })).toBeChecked();

    await userEvent.click(screen.getByRole('radio', { name: LANGUAGE_NAMES.ar }));
    expect(await screen.findByRole('heading', { name: ar.login.title })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });

  it('switches light / dark / system and persists the choice', async () => {
    renderRoutes(ROUTES.login);
    await screen.findByRole('heading', { name: en.login.title });
    const theme = screen.getByRole('radiogroup', { name: en.prefs.theme });
    expect(theme).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: en.prefs.dark }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark');
    await userEvent.click(screen.getByRole('radio', { name: en.prefs.light }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    await userEvent.click(screen.getByRole('radio', { name: en.prefs.system }));
    expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBe('system');
    expect(screen.getByRole('radio', { name: en.prefs.system })).toBeChecked();
  });

  it('arrow keys move the selection and follow the reading direction in RTL', async () => {
    renderRoutes(ROUTES.login, { language: 'ar' });
    await screen.findByRole('heading', { name: ar.login.title });
    screen.getByRole('radio', { name: LANGUAGE_NAMES.ar }).focus();
    // Arabic is first and selected; in RTL, ArrowLeft goes to the next (visually left) item.
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: LANGUAGE_NAMES.en })).toBeChecked();
  });

  it('shows the brand story and security note', async () => {
    renderRoutes(ROUTES.login);
    expect(await screen.findByText(en.login.brand.headline)).toBeInTheDocument();
    expect(screen.getByText(/Session ends after 2 days of inactivity/)).toBeInTheDocument();
  });
});

describe('viewport class on the login screen', () => {
  it('the app publishes data-bp / data-orientation before sign-in (layout CSS depends on it)', async () => {
    window.history.pushState({}, '', ROUTES.login);
    renderWithApp(<App />);
    await screen.findByRole('heading', { name: en.login.title });
    expect(document.documentElement.dataset['bp']).toBe('expanded');
    expect(document.documentElement.dataset['orientation']).toBeDefined();
  });
});

describe('login form details', () => {
  it('password can be shown and hidden without losing the value', async () => {
    renderRoutes(ROUTES.login);
    const input = await screen.findByLabelText(en.login.password);
    await userEvent.type(input, PASSWORD);
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: en.login.showPassword }));
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue(PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: en.login.hidePassword }));
    expect(input).toHaveAttribute('type', 'password');
  });

  async function toCodeStep() {
    await userEvent.type(await screen.findByLabelText(en.login.email), EMAIL);
    await userEvent.type(screen.getByLabelText(en.login.password), PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: en.login.continue }));
    return screen.findByLabelText(en.login.code);
  }

  it('code step: focuses the code field, shows the masked email and the resend timer', async () => {
    renderRoutes(ROUTES.login);
    const code = await toCodeStep();
    expect(code).toHaveFocus();
    expect(screen.getByRole('heading', { name: en.login.codeTitle })).toBeInTheDocument();
    expect(screen.getByText('a•••n@example.test')).toBeInTheDocument();
    expect(screen.getByText(`Resend in ${formatClock(RESEND_SECONDS)}`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: en.login.resend })).toBeNull();
  });

  it('resend becomes available after the wait, calls the repository and restarts the timer', async () => {
    const auth = new MockAuthRepository(0);
    const resend = vi.spyOn(auth, 'login');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderRoutes(ROUTES.login, { container: makeContainer(auth) });
    await toCodeStep();

    try {
      await tick(RESEND_SECONDS);
      const button = screen.getByRole('button', { name: en.login.resend });
      await userEvent.click(button);
      await act(() => vi.advanceTimersByTimeAsync(50));
      expect(resend).toHaveBeenCalledTimes(2); // step 1, then once more to resend
      expect(screen.getByText(`Resend in ${formatClock(RESEND_SECONDS)}`)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a failed resend shows a localized alert and keeps the button', async () => {
    const auth = new MockAuthRepository(0);
    vi.spyOn(auth, 'login')
      .mockResolvedValueOnce({
        otpRequired: true,
        expiresAt: Date.now() + 600_000,
        resendAfterSeconds: RESEND_SECONDS,
      })
      .mockRejectedValue(new AppError({ kind: 'rateLimited' }));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderRoutes(ROUTES.login, { container: makeContainer(auth) });
    await toCodeStep();

    try {
      await tick(RESEND_SECONDS);
      await userEvent.click(screen.getByRole('button', { name: en.login.resend }));
      await act(() => vi.advanceTimersByTimeAsync(50));
      expect(screen.getByRole('alert')).toHaveTextContent(en.errors.rateLimited);
      expect(screen.getByRole('button', { name: en.login.resend })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a wrong code shows an inline alert, not a full-page error', async () => {
    renderRoutes(ROUTES.login);
    const code = await toCodeStep();
    await userEvent.type(code, '0'.repeat(OTP_LENGTH));
    await userEvent.click(screen.getByRole('button', { name: en.login.verify }));
    expect(await screen.findByText(en.errors.validation)).toBeInTheDocument();
    expect(document.querySelector('.app-alert')).not.toBeNull();
    expect(screen.getByLabelText(en.login.code)).toBeInTheDocument();
  });
});
