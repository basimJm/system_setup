import { act, fireEvent, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_IDLE_MS } from '@/constants/session';
import { MockAuthRepository } from '@/data/auth/MockAuthRepository';
import { IdleWarningDialog } from '@/presentation/components/feedback/IdleWarningDialog';
import { useIdleTimeout } from '@/presentation/hooks/useIdleTimeout';
import { makeContainer, renderRoutes, renderWithApp, signInContainer } from './helpers/render';

const MIN = 60_000;
/** The mechanics are tested on a short window; the real default (2 days) has its own test below. */
const IDLE_MS = 30 * MIN;

describe('useIdleTimeout', () => {
  let clock = 0;
  const now = () => clock;
  const advance = async (ms: number) => {
    clock += ms;
    await act(() => vi.advanceTimersByTimeAsync(ms));
  };
  beforeEach(() => {
    vi.useFakeTimers();
    clock = 1_000_000;
  });
  afterEach(() => vi.useRealTimers());

  const setup = (onExpire = vi.fn()) => ({
    onExpire,
    ...renderHook(() => useIdleTimeout({ onExpire, now, idleMs: IDLE_MS })),
  });

  it('stays active, then warns during the last minute with a countdown, then expires once', async () => {
    const { result, onExpire } = setup();
    await advance(10 * MIN);
    expect(result.current.status.state).toBe('active');
    await advance(19 * MIN);
    expect(result.current.status.state).toBe('warning');
    expect(result.current.status.secondsLeft).toBe(60);
    await advance(20_000);
    expect(result.current.status.secondsLeft).toBe(40);
    expect(onExpire).not.toHaveBeenCalled();
    await advance(40_000);
    expect(onExpire).toHaveBeenCalledTimes(1);
    await advance(5 * MIN);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('real input before the warning restarts the countdown', async () => {
    const { result, onExpire } = setup();
    await advance(25 * MIN);
    fireEvent.keyDown(window, { key: 'a' });
    await advance(25 * MIN);
    expect(result.current.status.state).toBe('active');
    expect(onExpire).not.toHaveBeenCalled();
    await advance(4 * MIN + 30_000);
    expect(result.current.status.state).toBe('warning');
  });

  it('mouse movement is not activity', async () => {
    const { result } = setup();
    await advance(25 * MIN);
    fireEvent.mouseMove(window);
    await advance(4 * MIN + 30_000);
    expect(result.current.status.state).toBe('warning');
  });

  it('input during the warning does not extend the session; stay() does', async () => {
    const { result, onExpire } = setup();
    await advance(29 * MIN + 10_000);
    fireEvent.pointerDown(window);
    await advance(30_000);
    expect(result.current.status.state).toBe('warning');
    act(() => result.current.stay());
    expect(result.current.status.state).toBe('active');
    await advance(20 * MIN);
    expect(result.current.status.state).toBe('active');
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('by default the admin stays signed in for 2 days of inactivity (owner 2026-10-26)', async () => {
    expect(SESSION_IDLE_MS).toBe(2 * 24 * 60 * MIN);
    const onExpire = vi.fn();
    const { result } = renderHook(() => useIdleTimeout({ onExpire, now }));
    clock += 24 * 60 * MIN; // a whole day idle: the clock jumps, one timer tick reads it
    await advance(1000);
    expect(result.current.status.state).toBe('active');
    clock += SESSION_IDLE_MS - 24 * 60 * MIN - 2 * MIN;
    await advance(1000);
    expect(result.current.status.state).toBe('active');
    clock += MIN + 30_000;
    await advance(1000);
    expect(result.current.status.state).toBe('warning');
    expect(onExpire).not.toHaveBeenCalled();
    clock += MIN;
    await advance(1000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('can be switched off', async () => {
    const onExpire = vi.fn();
    renderHook(() => useIdleTimeout({ onExpire, now, enabled: false }));
    await advance(2 * 60 * MIN);
    expect(onExpire).not.toHaveBeenCalled();
  });
});

describe('IdleWarningDialog', () => {
  it('shows the seconds left (Arabic digits in Arabic) and offers stay and sign out', async () => {
    const onStay = vi.fn();
    const onSignOut = vi.fn();
    const { unmount } = renderWithApp(
      <IdleWarningDialog open secondsLeft={42} onStay={onStay} onSignOut={onSignOut} />,
    );
    expect(screen.getByRole('dialog', { name: 'Still there?' })).toBeVisible();
    expect(screen.getByText(/ends in 42 seconds/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Stay signed in' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onStay).toHaveBeenCalledTimes(1);
    expect(onSignOut).toHaveBeenCalledTimes(1);
    unmount();
    renderWithApp(
      <IdleWarningDialog open secondsLeft={42} onStay={onStay} onSignOut={onSignOut} />,
      undefined,
      'ar',
    );
    expect(screen.getByText(/٤٢/)).toBeVisible();
  });

  it('is absent when closed', () => {
    renderWithApp(
      <IdleWarningDialog
        open={false}
        secondsLeft={5}
        onStay={() => undefined}
        onSignOut={() => undefined}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('shell sign out and login notice', () => {
  it('Sign out revokes the refresh token and clears the session', async () => {
    const auth = new MockAuthRepository(0);
    const container = makeContainer(auth);
    const logout = vi.spyOn(auth, 'logout');
    await auth.login('a@b.co');
    container.session.set(await auth.verifyOtp('a@b.co', '123456'));
    const token = container.session.get()?.refreshToken;
    renderRoutes('/items', { container });
    await userEvent.click(await screen.findByRole('button', { name: /Demo Admin|a@b/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(logout).toHaveBeenCalledWith(token);
    expect(container.session.get()).toBeNull();
    expect(container.session.endReason()).toBeNull();
  });

  it.each([
    ['expired', 'Your session expired. Please sign in again.'],
    ['idle', 'You were signed out after 2 days of inactivity.'],
  ] as const)('the login page explains a session that ended by %s', async (reason, text) => {
    const container = makeContainer();
    await signInContainer(container);
    container.session.clear(reason);
    renderRoutes('/login', { container });
    expect(await screen.findByText(text)).toBeVisible();
  });

  it('a normal sign-out shows no notice', async () => {
    const container = makeContainer();
    renderRoutes('/login', { container });
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
