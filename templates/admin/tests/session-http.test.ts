import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createSessionStore } from '@/app/session';
import { createSessionManager } from '@/app/sessionManager';
import { MockAuthRepository } from '@/data/auth/MockAuthRepository';
import type { Session } from '@/domain/auth/auth';
import { createLogger } from '@/infrastructure/logger/logger';
import { HttpClient, type FetchFn } from '@/infrastructure/http/HttpClient';

const logger = createLogger('silent');
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

describe('mock auth repository rotation', () => {
  it('a refresh token works once; logout revokes it', async () => {
    const repo = new MockAuthRepository(0);
    await repo.login('a@b.co');
    const first = await repo.verifyOtp('a@b.co', '123456');
    expect(first.refreshToken).toBeDefined();
    expect(first.accessExpiresAt).toBeGreaterThan(Date.now());
    const second = await repo.refresh(first.refreshToken ?? '');
    expect(second.refreshToken).not.toBe(first.refreshToken);
    await expect(repo.refresh(first.refreshToken ?? '')).rejects.toMatchObject({
      kind: 'unauthorized',
    });
    await repo.logout(second.refreshToken);
    await expect(repo.refresh(second.refreshToken ?? '')).rejects.toMatchObject({
      kind: 'unauthorized',
    });
  });
});

describe('HttpClient with a session', () => {
  const reply401 = () =>
    new Response(
      JSON.stringify({ success: false, message: 'no', error: { code: 'UNAUTHORIZED' } }),
      { status: 401 },
    );
  const ok = () =>
    new Response(JSON.stringify({ success: true, message: 'ok', data: { n: 1 } }), { status: 200 });
  const schema = z.object({ n: z.number() });

  function setup(
    responses: Response[],
    over: { refreshSession?: () => Promise<boolean>; ensureFresh?: () => Promise<void> } = {},
  ) {
    const queue = [...responses];
    const tokens: string[] = [];
    let token = 'old';
    const fetchFn = vi.fn<FetchFn>((_url, init) => {
      tokens.push((init.headers as Record<string, string>)['Authorization'] ?? '');
      return Promise.resolve(queue.shift() ?? ok());
    });
    const onUnauthorized = vi.fn();
    const http = new HttpClient({
      baseUrl: 'https://api.test',
      fetchFn,
      getToken: () => token,
      getLanguage: () => 'en',
      onUnauthorized,
      sleep: () => Promise.resolve(),
      ...over,
    });
    return { http, fetchFn, tokens, onUnauthorized, setToken: (t: string) => (token = t) };
  }

  it('a 401 refreshes once and repeats the request with the new token', async () => {
    const ctx = setup([reply401(), ok()], {
      refreshSession: () => {
        ctx.setToken('new');
        return Promise.resolve(true);
      },
    });
    const result = await ctx.http.get('/x', { schema });
    expect(result.data).toEqual({ n: 1 });
    expect(ctx.tokens).toEqual(['Bearer old', 'Bearer new']);
    expect(ctx.onUnauthorized).not.toHaveBeenCalled();
  });

  it('a 401 whose refresh fails reports unauthorized once', async () => {
    const ctx = setup([reply401()], { refreshSession: () => Promise.resolve(false) });
    await expect(ctx.http.get('/x', { schema })).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(ctx.fetchFn).toHaveBeenCalledTimes(1);
    expect(ctx.onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('a 401 right after a successful refresh is final (no refresh loop)', async () => {
    const refresh = vi.fn(() => Promise.resolve(true));
    const ctx = setup([reply401(), reply401()], { refreshSession: refresh });
    await expect(ctx.http.get('/x', { schema })).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(ctx.fetchFn).toHaveBeenCalledTimes(2);
    expect(ctx.onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('without a refresh hook a 401 simply ends the session', async () => {
    const ctx = setup([reply401()]);
    await expect(ctx.http.get('/x', { schema })).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(ctx.onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('the auth calls themselves (noRefresh) never refresh', async () => {
    const refresh = vi.fn(() => Promise.resolve(true));
    const ensure = vi.fn(() => Promise.resolve());
    const ctx = setup([reply401()], { refreshSession: refresh, ensureFresh: ensure });
    await expect(
      ctx.http.post('/auth/refresh', { schema, body: {}, noRefresh: true }),
    ).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(refresh).not.toHaveBeenCalled();
    expect(ensure).not.toHaveBeenCalled();
  });

  it('ensureFresh runs before every normal request', async () => {
    const ensure = vi.fn(() => Promise.resolve());
    const ctx = setup([ok(), ok()], { ensureFresh: ensure });
    await ctx.http.get('/x', { schema });
    await ctx.http.get('/y', { schema });
    expect(ensure).toHaveBeenCalledTimes(2);
  });

  it('many requests refused at once cause a single refresh through the manager', async () => {
    const store = createSessionStore();
    store.set(session());
    const repo = new MockAuthRepository(0);
    await repo.login('a@b.co');
    const live = await repo.verifyOtp('a@b.co', '123456');
    store.set(live);
    const manager = createSessionManager({ store, auth: () => repo, logger });
    const spy = vi.spyOn(repo, 'refresh');
    const queue = [reply401(), reply401(), reply401()];
    const fetchFn = vi.fn<FetchFn>(() => Promise.resolve(queue.shift() ?? ok()));
    const http = new HttpClient({
      baseUrl: 'https://api.test',
      fetchFn,
      getToken: () => store.get()?.accessToken ?? null,
      getLanguage: () => 'en',
      onUnauthorized: () => store.clear('expired'),
      refreshSession: () => manager.refresh(),
      sleep: () => Promise.resolve(),
    });
    const results = await Promise.all([
      http.get('/a', { schema }),
      http.get('/b', { schema }),
      http.get('/c', { schema }),
    ]);
    expect(results.map((r) => r.data.n)).toEqual([1, 1, 1]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(store.get()).not.toBeNull();
  });
});
