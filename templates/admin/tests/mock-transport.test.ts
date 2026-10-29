import { describe, expect, it, vi } from 'vitest';
import { MOCK_ERROR_SCENARIOS, MOCK_SCENARIOS, type MockScenario } from '@/constants/mock';
import { ApiClient } from '@/data/api/ApiClient';
import { defineEndpoint } from '@/data/api/endpoint';
import { getSettingsDataSchema } from '@/data/contract/generated/dto';
import { OPERATIONS } from '@/data/contract/generated/operations';
import { createMockRoutes } from '@/data/mock/fixtures';
import { createMockTransport } from '@/data/mock/mockTransport';
import { createScenarioStore, isMockScenario } from '@/data/mock/scenarios';
import { AppError } from '@/infrastructure/errors/AppError';
import { HttpClient } from '@/infrastructure/http/HttpClient';

const endpoint = defineEndpoint(OPERATIONS.getSettings, { data: getSettingsDataSchema });

function setup(scenario: MockScenario = 'success', language: 'ar' | 'en' = 'en') {
  const scenarios = createScenarioStore(scenario);
  const sleep = vi.fn((_ms: number) => Promise.resolve());
  const fetchFn = createMockTransport({ routes: createMockRoutes(), scenarios, sleep });
  const http = new HttpClient({
    baseUrl: 'https://api.example.test',
    fetchFn,
    getToken: () => null,
    getLanguage: () => language,
    timeoutMs: 50,
  });
  return { api: new ApiClient(http), scenarios, sleep };
}

describe('mock transport', () => {
  it('serves a fixture through the real client and validates it against the contract', async () => {
    const { api } = setup();
    const page = await api.executePage(endpoint);
    expect(page.items.map((s) => s.key)).toContain('otp.length');
    expect(page.meta.total).toBe(page.items.length);
  });

  it('every fixture route exists in the contract with the same method and path', () => {
    const known = new Set(Object.values(OPERATIONS).map((o) => `${o.method} ${o.path}`));
    for (const r of createMockRoutes()) expect(known.has(`${r.method} ${r.path}`)).toBe(true);
  });

  it('empty returns an empty page', async () => {
    const page = await setup('empty').api.executePage(endpoint);
    expect(page.items).toEqual([]);
    expect(page.meta.total).toBe(0);
  });

  it.each(Object.keys(MOCK_ERROR_SCENARIOS) as (keyof typeof MOCK_ERROR_SCENARIOS)[])(
    '%s scenario fails with the matching status and code',
    async (scenario) => {
      const { api } = setup(scenario);
      const error = await api.execute(endpoint).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        status: MOCK_ERROR_SCENARIOS[scenario].status,
        code: MOCK_ERROR_SCENARIOS[scenario].code,
      });
    },
  );

  it('validation reports a per-field detail and every error has a trace id', async () => {
    const error = await setup('validation')
      .api.execute(endpoint)
      .catch((e: unknown) => e);
    expect(error).toMatchObject({
      details: [{ field: 'body.name' }],
      traceId: expect.stringMatching(/^mock-/) as string,
    });
  });

  it('localizes the server message by Accept-Language', async () => {
    const en = await setup('forbidden', 'en')
      .api.execute(endpoint)
      .catch((e: unknown) => e);
    const ar = await setup('forbidden', 'ar')
      .api.execute(endpoint)
      .catch((e: unknown) => e);
    expect((en as AppError).serverMessage).toBe('You do not have permission');
    expect((ar as AppError).serverMessage).toMatch(/[؀-ۿ]/);
  });

  it('timeout never answers, so the client times out', async () => {
    const error = await setup('timeout')
      .api.execute(endpoint)
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: 'timeout' });
  });

  it('slow waits much longer than the normal latency', async () => {
    const normal = setup();
    await normal.api.execute(endpoint);
    const slow = setup('slow');
    await slow.api.execute(endpoint);
    expect(Number(slow.sleep.mock.calls[0]?.[0])).toBeGreaterThan(
      Number(normal.sleep.mock.calls[0]?.[0]),
    );
  });

  it('unknown paths answer 404 like the server', async () => {
    const fetchFn = createMockTransport({
      routes: [],
      scenarios: createScenarioStore(),
      sleep: () => Promise.resolve(),
    });
    const res = await fetchFn('https://api.example.test/admin/v1/nope', { method: 'GET' });
    expect(res.status).toBe(404);
  });

  it('the scenario can be switched at runtime', async () => {
    const { api, scenarios } = setup();
    await api.execute(endpoint);
    scenarios.set('serverError');
    await expect(api.execute(endpoint)).rejects.toMatchObject({ status: 500 });
  });
});

describe('scenario store', () => {
  it('notifies on change only and stops after unsubscribe', () => {
    const store = createScenarioStore();
    const seen = vi.fn();
    const off = store.subscribe(seen);
    store.set('success');
    store.set('empty');
    off();
    store.set('slow');
    expect(seen).toHaveBeenCalledTimes(1);
    expect(store.get()).toBe('slow');
  });

  it('knows exactly the declared scenarios', () => {
    for (const s of MOCK_SCENARIOS) expect(isMockScenario(s)).toBe(true);
    expect(isMockScenario('nope')).toBe(false);
  });
});
