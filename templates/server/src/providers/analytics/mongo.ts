import type { ServerEventInput, ServerEvents } from '../../domain/events';
import { IDENTITY_LINKED_EVENT } from '../../constants/providers';
import { ExternalServiceError } from '../../utils/errors';
import { isValidTimeZone } from '../../utils/time';
import type { AnalyticsProvider, EventCountQuery, EventCountRow, IdentityLink } from './types';

/** The part of the server-events repository the provider needs. */
export interface EventCounter {
  countGrouped(query: EventCountQuery): Promise<EventCountRow[]>;
}

/** Analytics over the server events kept in MongoDB. */
export const createMongoAnalytics = (deps: {
  events: ServerEvents;
  counter: EventCounter;
}): AnalyticsProvider => ({
  track: (event: ServerEventInput) => deps.events.track(event),

  async linkIdentity(link: IdentityLink) {
    await deps.events.track({
      name: IDENTITY_LINKED_EVENT,
      actorType: link.actorType,
      actorId: link.actorId,
      params: { installationId: link.installationId },
    });
  },

  async countEvents(query: EventCountQuery) {
    if (!isValidTimeZone(query.timeZone) || !(query.from < query.to)) {
      throw new RangeError('invalid analytics query');
    }
    try {
      return await deps.counter.countGrouped(query);
    } catch (error) {
      throw new ExternalServiceError({ cause: error });
    }
  },
});
