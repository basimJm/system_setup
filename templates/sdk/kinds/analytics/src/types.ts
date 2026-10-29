import type { EnvelopeType } from './constants/analytics';

export type Properties = Readonly<Record<string, string | number | boolean | null>>;

export interface AnalyticsEvent {
  /** `snake_case`, e.g. `booking_created`. */
  readonly name: string;
  readonly userId?: string;
  readonly anonymousId?: string;
  readonly properties?: Properties;
  /** Defaults to now. */
  readonly occurredAt?: Date;
}

/** Merges an anonymous history into a known user (after login / registration). */
export interface IdentityLink {
  readonly anonymousId: string;
  readonly userId: string;
  readonly occurredAt?: Date;
}

/** What a sink receives: normalised, timestamped, with a per-event id for de-duplication. */
export interface Envelope {
  readonly id: string;
  readonly type: EnvelopeType;
  readonly name: string;
  readonly userId?: string;
  readonly anonymousId?: string;
  readonly properties: Properties;
  readonly occurredAt: Date;
}

/** Where batches go (vendor API, warehouse, log). Throws for whole-batch failures. */
export interface AnalyticsSink {
  readonly name: string;
  readonly isFake?: boolean;
  deliver(batch: readonly Envelope[]): Promise<void>;
  close?(): Promise<void>;
}

/** The port: fire-and-forget tracking with batching; `flush` for shutdown and tests. */
export interface AnalyticsTracker {
  track(event: AnalyticsEvent): void;
  linkIdentity(link: IdentityLink): void;
  /** Delivers everything queued; resolves when the sink accepted it (or gave up). */
  flush(): Promise<void>;
  /** Queued, not yet delivered. */
  readonly pending: number;
  /** Events dropped because the queue was full or the sink finally failed. */
  readonly dropped: number;
  close(): Promise<void>;
}
