import type { ApiClient } from '@/data/api/ApiClient';
import { defineEndpoint } from '@/data/api/endpoint';
import {
  getSettingsDataSchema,
  putSettingsByKeyBodySchema,
  putSettingsByKeyDataSchema,
} from '@/data/contract/generated/dto';
import { OPERATIONS } from '@/data/contract/generated/operations';
import {
  settingEntryOf,
  type SettingEntry,
  type SettingsRepository,
  type SettingWrite,
} from '@/domain/settings/settings';

const listEndpoint = defineEndpoint(OPERATIONS.getSettings, { data: getSettingsDataSchema });
const updateEndpoint = defineEndpoint(OPERATIONS.putSettingsByKey, {
  data: putSettingsByKeyDataSchema,
  body: putSettingsByKeyBodySchema,
});

export class RemoteSettingsRepository implements SettingsRepository {
  constructor(private readonly api: ApiClient) {}

  async list(): Promise<readonly SettingEntry[]> {
    const { data } = await this.api.execute(listEndpoint);
    return data.map(settingEntryOf);
  }

  async update(key: string, value: unknown, reason: string): Promise<SettingWrite> {
    const { data } = await this.api.execute(updateEndpoint, {
      params: { key },
      body: { value, reason },
    });
    return { key: data.key, value: data.value };
  }
}
