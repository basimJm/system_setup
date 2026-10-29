import { Schema, model } from 'mongoose';
import { SETTINGS_COLLECTION } from '../constants/settings';

/**
 * One setting an admin has changed (BUSINESS_DOMAIN.md §3.7). A key with no document uses its
 * default, so the collection only holds overrides.
 */
export interface SettingRaw {
  key: string;
  value: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const settingSchema = new Schema<SettingRaw>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true, collection: SETTINGS_COLLECTION },
);

export const SettingModel = model<SettingRaw>('Setting', settingSchema);
