import { describe, expect, it, vi } from 'vitest';
import { createSessionStore } from '@/app/session';
import { createSessionManager } from '@/app/sessionManager';
import type { AuthRepository, Session } from '@/domain/auth/auth';
import { canRefresh, idleStatus, isExpiringSoon } from '@/domain/auth/sessionRules';
import { createLogger } from '@/infrastructure/logger/logger';

const NOW = 1_000_000;
const MIN = 60_000;
const session = (over: Partial<Session> = {}): Session => ({
  accessToken: 'a1',
  admin: { id: '1', name: 'A', email: 'a@b.co' },
  accessExpiresAt: NOW + 10 * MIN,
  refreshToken: 'r1',
  refreshExpiresAt: NOW + 30 * MIN,
  ...over,
});
const logger = createLogger('silent');

describe('session rules', () => {
  it.each([
    [NOW + 10 * MIN, false],
    [NOW + MIN, true],
    [NOW + MIN + 1, false],
    [NOW - 1, true],
  ])('access expiring at %s within 1 min: %s', (expires, expected) => {
    expect(isExpiringSoon(session({ accessExpiresAt: expires }), NOW, MIN)).toBe(expected);
  });
  it('an unknown expiry is never "expiring"', () => {
    expect(isExpiringSoon(session({ accessExpiresAt: undefined }), NOW, MIN)).toBe(false);
  });
  it('canRefresh needs a refresh token that has not expired', () => {
    expect(canRefresh(session(), NOW)).toBe(true);
    expect(canRefresh(session({ refreshToken: undefined }), NOW)).toBe(false);
    expect(canRefresh(session({ refreshExpiresAt: NOW }), NOW)).toBe(false);
    expect(canRefresh(session({ refreshExpiresAt: undefined }), NOW)).toBe(true);
  });
  it.each([
    [0, 'active', 1800],
    [29 * MIN - 1, 'active', 61],
    [29 * MIN, 'warning', 60],
    [29 * MIN + 1, 'warning', 60],
    [29 * MIN + 30_000, 'warning', 30],
    [30 * MIN - 1, 'warning', 1],
    [30 * MIN, 'expired', 0],
    [45 * MIN, 'expired', 0],
  ])('idle for %s ms -> %s', (idle, state) => {
    expect(idleStatus(0, idle, 30 * MIN, MIN).state).toBe(state);
  });
  it('the warning counts seconds down, rounded up', () => {
    expect(idleStatus(0, 29 * MIN + 500, 30 * MIN, MIN).secondsLeft).toBe(60);
    expect(idleStatus(0, 30 * MIN - 1, 30 * MIN, MIN).secondsLeft).toBe(1);
  });
});

describe('session store', () => {
  it('remembers why a session ended until the next sign-in', () => {
    const store = createSessionStore();
    store.set(session());
    store.clear('idle');
    expect(store.endReason()).toBe('idle');
    store.set(session());
    expect(store.endReason()).toBeNull();
    store.clear();
    expect(store.endReason()).toBeNull();
  });
  it('clearing an empty store does nothing and keeps the earlier reason', () => {
    const store = createSessionStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.clear('expired');
    expect(listener).not.toHaveBeenCalled();
  });
});

interface FakeAuth {
  refresh: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
}
function fakeAuth(
  refresh: (token: string) => Promise<Session> = () =>
    Promise.resolve(session({ accessToken: 'a2', refreshToken: 'r2' })),
): FakeAuth {
  return { refresh: vi.fn(refresh), logout: vi.fn(() => Promise.resolve()) };
}

describe('session manager', () => {
  const make = (auth = fakeAuth(), start: Session | null = session()) => {
    const store = createSessionStore();
    if (start) store.set(start);
    return {
      auth,
      store,
      manager: createSessionManager({
        store,
        auth: () => auth as unknown as AuthRepository,
        logger,
        now: () => NOW,
        skewMs: MIN,
      }),
    };
  };

  it('ensureFresh does nothing while the token is valid or has no known expiry', async () => {
    const a = make();
    await a.manager.ensureFresh();
    const b = make(fakeAuth(), session({ accessExpiresAt: undefined }));
    await b.manager.ensureFresh();
    expect(a.auth.refresh).not.toHaveBeenCalled();
    expect(b.auth.refresh).not.toHaveBeenCalled();
  });

  it('ensureFresh refreshes a token that is about to expire and stores the new session', async () => {
    const { auth, store, manager } = make(undefined, session({ accessExpiresAt: NOW + 10_000 }));
    await manager.ensureFresh();
    expect(auth.refresh).toHaveBeenCalledWith('r1');
    expect(store.get()?.accessToken).toBe('a2');
  });

  it('does not try to refresh without a usable refresh token', async () => {
    const { auth, manager } = make(
      undefined,
      session({ accessExpiresAt: NOW - 1, refreshExpiresAt: NOW - 1 }),
    );
    await manager.ensureFresh();
    expect(auth.refresh).not.toHaveBeenCalled();
    expect(await manager.refresh()).toBe(false);
  });

  it('shares one refresh between simultaneous callers', async () => {
    let release: (s: Session) => void = () => undefined;
    const auth = fakeAuth(() => new Promise<Session>((resolve) => (release = resolve)));
    const { manager, store } = make(auth);
    const calls = Promise.all([
      manager.refresh(),
      manager.refresh(),
      manager.refresh(),
      manager.refresh(),
    ]);
    release(session({ accessToken: 'a2', refreshToken: 'r2' }));
    expect(await calls).toEqual([true, true, true, true]);
    expect(auth.refresh).toHaveBeenCalledTimes(1);
    expect(store.get()?.refreshToken).toBe('r2');
    const again = manager.refresh();
    release(session({ accessToken: 'a3', refreshToken: 'r3' }));
    await again;
    expect(auth.refresh).toHaveBeenCalledTimes(2);
  });

  it('a failed refresh ends the session as expired and reports false', async () => {
    const { manager, store } = make(fakeAuth(() => Promise.reject(new Error('revoked'))));
    expect(await manager.refresh()).toBe(false);
    expect(store.get()).toBeNull();
    expect(store.endReason()).toBe('expired');
    await expect(manager.ensureFresh()).resolves.toBeUndefined();
  });

  it('never brings a session back after the admin signed out during the refresh', async () => {
    let release: (s: Session) => void = () => undefined;
    const auth = fakeAuth(() => new Promise<Session>((resolve) => (release = resolve)));
    const { manager, store } = make(auth);
    const pending = manager.refresh();
    await manager.signOut();
    release(session({ accessToken: 'a2', refreshToken: 'r2' }));
    expect(await pending).toBe(false);
    expect(store.get()).toBeNull();
  });

  it('sign out revokes the refresh token and clears the session with the reason', async () => {
    const { auth, store, manager } = make();
    await manager.signOut('idle');
    expect(auth.logout).toHaveBeenCalledWith('r1');
    expect(store.get()).toBeNull();
    expect(store.endReason()).toBe('idle');
  });

  it('sign out still clears when the server cannot be reached, and skips the call without a token', async () => {
    const failing = fakeAuth();
    failing.logout.mockRejectedValueOnce(new Error('offline'));
    const a = make(failing);
    await expect(a.manager.signOut()).resolves.toBeUndefined();
    expect(a.store.get()).toBeNull();
    const b = make(fakeAuth(), session({ refreshToken: undefined }));
    await b.manager.signOut();
    expect(b.auth.logout).not.toHaveBeenCalled();
    expect(b.store.get()).toBeNull();
  });
});
