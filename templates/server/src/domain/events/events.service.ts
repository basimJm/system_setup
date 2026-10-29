import { z } from 'zod';
import {
  EVENT_APP_VERSION_MAX_LENGTH,
  EVENT_NAME_MAX_LENGTH,
  EVENT_NAME_PATTERN,
} from '../../constants/audit';
import { OBJECT_ID_PATTERN } from '../../constants/database';
import { ACTOR_TYPES, PLATFORMS } from '../../constants/enums';
import type { Logger } from '../../utils/logger';
import { redactSensitive } from '../../utils/logger/redact';

const objectId = z.string().regex(OBJECT_ID_PATTERN);

export const serverEventSchema = z.object({
  name: z.string().max(EVENT_NAME_MAX_LENGTH).regex(EVENT_NAME_PATTERN),
  actorType: z.enum(ACTOR_TYPES),
  actorId: objectId.optional(),
  params: z.record(z.string(), z.unknown()).default({}),
  platform: z.enum(PLATFORMS).optional(),
  appVersion: z.string().min(1).max(EVENT_APP_VERSION_MAX_LENGTH).optional(),
});

export type ServerEventInput = z.input<typeof serverEventSchema>;

export interface ServerEventStore {
  append(data: Record<string, unknown>): Promise<unknown>;
}

export interface ServerEventsDeps {
  readonly store: ServerEventStore;
  readonly logger: Logger;
  readonly now?: () => Date;
}

export interface ServerEvents {
  /**
   * Records one event and NEVER throws: analytics must not break the request that produced it.
   * Invalid events and storage failures are logged; the result says whether the event was stored.
   * Secrets in `params` are redacted before storage.
   */
  track(event: ServerEventInput): Promise<boolean>;
}

export const createServerEvents = ({
  store,
  logger,
  now = () => new Date(),
}: ServerEventsDeps): ServerEvents => ({
  async track(event) {
    const parsed = serverEventSchema.safeParse(event);
    if (!parsed.success) {
      logger.warn(
        { eventName: typeof event.name === 'string' ? event.name : undefined },
        'server event rejected',
      );
      return false;
    }
    try {
      const { params, ...rest } = parsed.data;
      await store.append({ ...rest, params: redactSensitive(params), ts: now() });
      return true;
    } catch (error) {
      logger.error({ err: error, eventName: parsed.data.name }, 'server event could not be stored');
      return false;
    }
  },
});
