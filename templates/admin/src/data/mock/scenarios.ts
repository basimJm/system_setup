import { DEFAULT_MOCK_SCENARIO, MOCK_SCENARIOS, type MockScenario } from '@/constants/mock';

export interface ScenarioStore {
  get(): MockScenario;
  set(next: MockScenario): void;
  subscribe(listener: () => void): () => void;
}

export const isMockScenario = (value: unknown): value is MockScenario =>
  typeof value === 'string' && (MOCK_SCENARIOS as readonly string[]).includes(value);

/** The scenario the mock transport answers with; the dev switcher changes it at runtime. */
export function createScenarioStore(initial: MockScenario = DEFAULT_MOCK_SCENARIO): ScenarioStore {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(next) {
      if (next === current) return;
      current = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
