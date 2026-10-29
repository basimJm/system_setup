import { OPERATIONS } from '../contract/generated/operations';
import {
  getSettingsDataSchema,
  putSettingsByKeyBodySchema,
  putSettingsByKeyDataSchema,
} from '../contract/generated/dto';
import { defineEndpoint } from '../api/endpoint';
import { mockRoute } from './mockRoute';
import { MOCK_SETTING_DEFAULTS } from './settingsFixture';
import type { MockRoute } from './mockTransport';

const settingsEndpoint = defineEndpoint(OPERATIONS.getSettings, { data: getSettingsDataSchema });
const updateSettingEndpoint = defineEndpoint(OPERATIONS.putSettingsByKey, {
  data: putSettingsByKeyDataSchema,
  body: putSettingsByKeyBodySchema,
});

/** Settings server: overrides live in the closure, so every container gets its own state. */
export function settingsRoutes(): readonly MockRoute[] {
  const overrides = new Map<string, unknown>();
  const valueOf = (key: string) =>
    overrides.has(key) ? overrides.get(key) : MOCK_SETTING_DEFAULTS[key];
  const entry = (key: string) => ({
    key,
    value: valueOf(key),
    default: MOCK_SETTING_DEFAULTS[key],
  });
  return [
    mockRoute(settingsEndpoint, () => {
      const data = Object.keys(MOCK_SETTING_DEFAULTS).map(entry);
      return {
        data,
        meta: { page: 1, pageSize: data.length, total: data.length, totalPages: 1 },
        empty: [],
      };
    }),
    mockRoute(updateSettingEndpoint, ({ params, body }) => {
      const key = params['key'] ?? '';
      overrides.set(key, (body as { value: unknown }).value);
      return { data: { key, value: valueOf(key) } };
    }),
  ];
}
