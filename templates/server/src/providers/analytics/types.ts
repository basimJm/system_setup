import type { AnalyticsGrouping } from '../../constants/providers';
import type { ServerEventInput } from '../../domain/events';

export interface EventCountQuery {
  /** Event names to count; empty or missing = all. */
  readonly names?: readonly string[];
  /** Half-open range `[from, to)` of event times. */
  readonly from: Date;
  readonly to: Date;
  readonly groupBy: AnalyticsGrouping;
  /** Business time zone used for `DAY` groups (settings.timezone). */
  readonly timeZone: string;
}

export interface EventCountRow {
  /** Event name for `NAME`, local date `YYYY-MM-DD` for `DAY`. */
  readonly key: string;
  readonly count: number;
}

export interface IdentityLink {
  /** Installation id sent by the app. */
  readonly installationId: string;
  readonly actorType: 'CUSTOMER' | 'MEMBER';
  readonly actorId: string;
}

/**
 * Server-side events and analytics queries behind one interface.
 * `track` never throws (analytics must not break a request). Queries are typed per question; the
 * dashboards add theirs here. Query failures throw `ExternalServiceError`.
 */
export interface AnalyticsProvider {
  /** Resolves to whether the event was stored. */
  track(event: ServerEventInput): Promise<boolean>;
  /** Links a guest installation to the account so guest history joins the journey. */
  linkIdentity(link: IdentityLink): Promise<void>;
  countEvents(query: EventCountQuery): Promise<EventCountRow[]>;
}
