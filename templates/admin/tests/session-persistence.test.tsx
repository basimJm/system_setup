import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContainerContext } from '@/app/ContainerContext';
import { createSessionStore, restoreSession } from '@/app/session';
import { MAX_TIMER_DELAY_MS, REFRESH_SKEW_MS, SESSION_IDLE_MS } from '@/constants/session';
import { MOCK_REFRESH_TTL_MS } from '@/constants/auth';
import { emailOf, MockAuthRepository } from '@/data/auth/MockAuthRepository';
import type { Session } from '@/domain/auth/auth';
import { refreshDelay } from '@/domain/auth/sessionRules';
import { SETTING_DEFINITIONS } from '@/domain/settings/registry';
import { parseSetting } from '@/domain/settings/validate';
import { MOCK_SETTING_DEFAULTS } from '@/data/mock/settingsFixture';
import { tabStorage, type KeyValueStorage } from '@/infrastructure/storage/tabStorage';
import { useProactiveRefresh } from '@/presentation/hooks/useProactiveRefresh';
import { makeContainer } from './helpers/render';

const NOW = 1_000_000;
const MIN = 60_000;
const KEY = 'admin.session';
const session = (over: Partial<Session> = {}): Session => ({
  accessToken: 'a1',
  admin: { id: '1', name: 'A', email: 'a@b.co' },
  accessExpiresAt: NOW + 15 * MIN,
  refreshToken: 'r1',
  refreshExpiresAt: NOW + SESSION_IDLE_MS,
  ...over,
});
const memoryStorage = (): KeyValueStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    get: (k) => data.get(k) ?? null,
    set: (k, v) => void data.set(k, v),
    remove: (k) => void data.delete(k),
  };
};

describe('session survives a reload (tab sessionStorage)', () => {
  it('set() stores the session, a new store (= reload) restores it, clear() removes it', () => {
    const storage = memoryStorage();
    const first = createSessionStore({ storage, key: KEY, now: () => NOW });
    expect(first.get()).toBeNull();
    first.set(session());
    expect(JSON.parse(storage.data.get(KEY) ?? '')).toMatchObject({ refreshToken: 'r1' });
    const reloaded = createSessionStore({ storage, key: KEY, now: () => NOW + MIN });
    expect(reloaded.get()).toEqual(session());
    reloaded.clear('idle');
    expect(storage.data.has(KEY)).toBe(false);
    expect(createSessionStore({ storage, key: KEY, now: () => NOW }).get()).toBeNull();
  });

  it('a session whose refresh token expired (2 days idle) is dropped on reload', () => {
    const storage = memoryStorage();
    storage.set(KEY, JSON.stringify(session()));
    expect(restoreSession({ storage, key: KEY, now: () => NOW + SESSION_IDLE_MS })).toBeNull();
    expect(storage.data.has(KEY)).toBe(false);
  });

  it.each([
    ['not JSON', '{oops'],
    ['wrong shape', JSON.stringify({ accessToken: 1 })],
    ['no refresh token', JSON.stringify({ ...session(), refreshToken: undefined })],
    ['null', 'null'],
  ])('ignores and removes a stored value that is %s', (_, raw) => {
    const storage = memoryStorage();
    storage.set(KEY, raw);
    expect(restoreSession({ storage, key: KEY, now: () => NOW })).toBeNull();
    expect(storage.data.has(KEY)).toBe(false);
  });

  it('without persistence the store stays in memory only', () => {
    const store = createSessionStore();
    store.set(session());
    expect(store.get()?.accessToken).toBe('a1');
  });

  it('tabStorage writes to sessionStorage (never localStorage) and never throws', () => {
    tabStorage.set(KEY, 'x');
    expect(window.sessionStorage.getItem(KEY)).toBe('x');
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(tabStorage.get(KEY)).toBe('x');
    tabStorage.remove(KEY);
    expect(tabStorage.get(KEY)).toBeNull();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => tabStorage.set(KEY, 'y')).not.toThrow();
    spy.mockRestore();
  });
});

describe('mock refresh tokens outlive the in-memory mock (reload in dev)', () => {
  it('a token issued by one mock instance refreshes on a new one, once', async () => {
    const before = new MockAuthRepository(0);
    await before.login('a@b.co');
    const issued = await before.verifyOtp('a@b.co', '123456');
    expect(issued.refreshExpiresAt).toBeDefined();
    expect(MOCK_REFRESH_TTL_MS).toBe(SESSION_IDLE_MS);
    const after = new MockAuthRepository(0);
    const next = await after.refresh(issued.refreshToken ?? '');
    expect(next.admin.email).toBe('a@b.co');
    await expect(after.refresh(issued.refreshToken ?? '')).rejects.toMatchObject({ status: 401 });
    await after.logout(next.refreshToken);
    await expect(after.refresh(next.refreshToken ?? '')).rejects.toMatchObject({ status: 401 });
  });

  it.each(['', 'other-token', 'mock-refresh-1', 'mock-refresh-1:%E0%A4%A'])(
    'emailOf(%j) is null',
    (token) => expect(emailOf(token)).toBeNull(),
  );
});

describe('proactive refresh', () => {
  it.each([
    [session(), 15 * MIN - REFRESH_SKEW_MS],
    [session({ accessExpiresAt: NOW + 30_000 }), 0],
    [session({ accessExpiresAt: undefined }), null],
    [session({ refreshToken: undefined }), null],
    [session({ refreshExpiresAt: NOW }), null],
    [session({ accessExpiresAt: NOW + 40 * 24 * 60 * MIN }), MAX_TIMER_DELAY_MS],
  ])('refreshDelay %#', (s, expected) => {
    expect(refreshDelay(s, NOW, REFRESH_SKEW_MS, MAX_TIMER_DELAY_MS)).toBe(expected);
  });

  describe('useProactiveRefresh', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const setup = (current: Session | null) => {
      const container = makeContainer();
      const ensureFresh = vi.spyOn(container.sessionManager, 'ensureFresh').mockResolvedValue();
      const wrapper = ({ children }: { children: ReactNode }) => (
        <ContainerContext.Provider value={container}>{children}</ContainerContext.Provider>
      );
      const hook = renderHook(() => useProactiveRefresh(current, () => NOW), { wrapper });
      return { ensureFresh, ...hook };
    };

    it('refreshes a minute before the access token expires, without a request', async () => {
      const { ensureFresh } = setup(session());
      await act(() => vi.advanceTimersByTimeAsync(15 * MIN - REFRESH_SKEW_MS - 1));
      expect(ensureFresh).not.toHaveBeenCalled();
      await act(() => vi.advanceTimersByTimeAsync(1));
      expect(ensureFresh).toHaveBeenCalledTimes(1);
    });

    it('checks at once when the tab comes back to the foreground', () => {
      const { ensureFresh } = setup(session());
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(ensureFresh).toHaveBeenCalledTimes(1);
    });

    it('does nothing while signed out and stops on unmount', async () => {
      const signedOut = setup(null);
      await act(() => vi.advanceTimersByTimeAsync(60 * MIN));
      expect(signedOut.ensureFresh).not.toHaveBeenCalled();
      const signedIn = setup(session());
      signedIn.unmount();
      await act(() => vi.advanceTimersByTimeAsync(60 * MIN));
      expect(signedIn.ensureFresh).not.toHaveBeenCalled();
    });
  });
});

describe('admin.sessionIdleSec setting accepts the 2-day session', () => {
  const def = SETTING_DEFINITIONS.find((d) => d.key === 'admin.sessionIdleSec');
  it('the admin can save 172800 s; the bounds still refuse silly values', () => {
    expect(def).toBeDefined();
    if (!def) return;
    expect(parseSetting(String(SESSION_IDLE_MS / 1000), def)).toEqual({ ok: true, value: 172_800 });
    expect(parseSetting('59', def)).toEqual({ ok: false, error: 'min' });
    expect(parseSetting('2592001', def)).toEqual({ ok: false, error: 'max' });
  });
  it('the mock server default matches the owner decision', () => {
    expect(MOCK_SETTING_DEFAULTS['admin.sessionIdleSec']).toBe(SESSION_IDLE_MS / 1000);
  });
});
