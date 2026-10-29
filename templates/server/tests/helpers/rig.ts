import { Types } from 'mongoose';
import { SETTING_DEFAULTS } from '../../src/constants/settings';
import type { SettingsService } from '../../src/domain/settings';
import { signAccessToken } from '../../src/utils/auth/accessToken';
import type { AccessEvents } from '../../src/domain/access/accessEvents';

export const SECRET = 'a'.repeat(48);
export const NOW = new Date('2026-10-12T10:00:00.000Z');
export const newId = (): string => new Types.ObjectId().toHexString();

/** Settings that answer the defaults, with per-test overrides. */
export const fakeSettings = (
  values: Record<string, unknown> = {},
): Pick<SettingsService, 'get'> => ({
  get: ((key: string) => Promise.resolve(values[key] ?? SETTING_DEFAULTS[key as never])) as never,
});

export const bearer = (
  type: 'CUSTOMER' | 'MEMBER' | 'ADMIN',
  id: string,
): Record<string, string> => ({
  Authorization: `Bearer ${signAccessToken({ secret: SECRET, subjectType: type, subjectId: id, ttlSec: 600 }).token}`,
});

/** Records the account events the domain emits. */
export const recordingAccess = (): AccessEvents & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    permissionsChanged: (id) => {
      calls.push(`permissions:${id}`);
      return Promise.resolve();
    },
    accessRevoked: (a) => {
      calls.push(`revoked:${a.scope}:${a.id}`);
      return Promise.resolve();
    },
    unreadChanged: (a, count) => {
      calls.push(`unread:${a.scope}:${a.id}:${String(count)}`);
      return Promise.resolve();
    },
  };
};
