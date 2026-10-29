import { OBJECT_ID_PATTERN } from '../../constants/database';
import { INSTALLATION_ID_PATTERN } from '../../constants/providers';
import { serverEventSchema, type ServerEventInput } from '../../domain/events';
import { isValidTimeZone, localDateOf } from '../../utils/time';
import type { AnalyticsProvider, EventCountQuery, EventCountRow, IdentityLink } from './types';

interface RecordedEvent {
  readonly name: string;
  readonly at: Date;
}

/** In-memory analytics for dev/test (production config refuses it). */
export class FakeAnalyticsProvider implements AnalyticsProvider {
  readonly events: (ReturnType<typeof serverEventSchema.parse> & { at: Date })[] = [];
  readonly links: IdentityLink[] = [];
  private readonly now: () => Date;

  constructor(now: () => Date = () => new Date()) {
    this.now = now;
  }

  track(event: ServerEventInput): Promise<boolean> {
    const parsed = serverEventSchema.safeParse(event);
    if (!parsed.success) return Promise.resolve(false);
    this.events.push({ ...parsed.data, at: this.now() });
    return Promise.resolve(true);
  }

  linkIdentity(link: IdentityLink): Promise<void> {
    if (
      !INSTALLATION_ID_PATTERN.test(link.installationId) ||
      !OBJECT_ID_PATTERN.test(link.actorId)
    ) {
      return Promise.reject(new RangeError('invalid identity link'));
    }
    const exists = this.links.some(
      (known) =>
        known.installationId === link.installationId &&
        known.actorType === link.actorType &&
        known.actorId === link.actorId,
    );
    if (!exists) this.links.push(link);
    return Promise.resolve();
  }

  countEvents(query: EventCountQuery): Promise<EventCountRow[]> {
    if (!isValidTimeZone(query.timeZone) || !(query.from < query.to)) {
      return Promise.reject(new RangeError('invalid analytics query'));
    }
    const wanted = new Set(query.names ?? []);
    const counts = new Map<string, number>();
    for (const recorded of this.events as readonly RecordedEvent[]) {
      if (recorded.at < query.from || recorded.at >= query.to) continue;
      if (wanted.size > 0 && !wanted.has(recorded.name)) continue;
      const key =
        query.groupBy === 'NAME' ? recorded.name : localDateOf(recorded.at, query.timeZone);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Promise.resolve(
      [...counts.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, count]) => ({ key, count })),
    );
  }
}
