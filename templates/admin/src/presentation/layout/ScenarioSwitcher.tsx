import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useContainer } from '@/app/ContainerContext';
import { MOCK_SCENARIOS, type MockScenario } from '@/constants/mock';

/** Dev-only control that changes how the mock transport answers. Absent (and compiled out) in prod builds. */
export function ScenarioSwitcher() {
  const { mock } = useContainer();
  const { t } = useTranslation();
  const scenario = useSyncExternalStore(
    (listener) => mock?.scenarios.subscribe(listener) ?? (() => undefined),
    () => mock?.scenarios.get() ?? null,
  );
  if (!__ALLOW_MOCK__ || !mock || scenario === null) return null;
  return (
    <label className="app-scenario">
      <span className="app-sr-only">{t('designKits.scenario')}</span>
      <select
        className="app-scenario__select"
        value={scenario}
        onChange={(e) => mock.scenarios.set(e.target.value as MockScenario)}
      >
        {MOCK_SCENARIOS.map((s) => (
          <option key={s} value={s}>
            {t(`designKits.scenarios.${s}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
