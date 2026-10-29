import { randomUUID } from 'node:crypto';
import { ERROR_CODES } from './constants/analytics';
import type { ResolvedConfig, TimerLike } from './config/options';
import { isSdkError, SdkError } from './errors';
import { realRetryDeps, withRetry, type RetryDeps } from './retry';
import type {
  AnalyticsEvent,
  AnalyticsSink,
  AnalyticsTracker,
  Envelope,
  IdentityLink,
} from './types';
import { assertEvent, assertLink } from './validation';

const IDENTITY_EVENT = 'identity_linked';

export const realTimers: TimerLike = {
  set: (callback, ms) => setTimeout(callback, ms).unref(),
  clear: (handle) => {
    clearTimeout(handle as NodeJS.Timeout);
  },
};

export interface TrackerDeps {
  readonly sink: AnalyticsSink;
  readonly retryDeps?: RetryDeps;
  readonly idGenerator?: () => string;
}

/**
 * Queues envelopes, delivers them in batches (size, timer or `flush()`), retries retryable sink
 * failures and never throws into the caller's hot path: analytics is best effort, counted when lost.
 */
export class Tracker implements AnalyticsTracker {
  private queue: Envelope[] = [];
  private timer: unknown;
  private inFlight: Promise<void> = Promise.resolve();
  private closed = false;
  private lost = 0;
  private readonly timers: TimerLike;
  private readonly retryDeps: RetryDeps;
  private readonly id: () => string;

  constructor(
    private readonly config: ResolvedConfig,
    private readonly deps: TrackerDeps,
  ) {
    this.timers = config.timers ?? realTimers;
    this.retryDeps = deps.retryDeps ?? realRetryDeps;
    this.id = deps.idGenerator ?? randomUUID;
  }

  get pending(): number {
    return this.queue.length;
  }

  get dropped(): number {
    return this.lost;
  }

  track(event: AnalyticsEvent): void {
    assertEvent(event);
    this.enqueue({
      id: this.id(),
      type: 'track',
      name: event.name,
      ...(event.userId === undefined ? {} : { userId: event.userId }),
      ...(event.anonymousId === undefined ? {} : { anonymousId: event.anonymousId }),
      properties: event.properties ?? {},
      occurredAt: event.occurredAt ?? this.config.now(),
    });
  }

  linkIdentity(link: IdentityLink): void {
    assertLink(link);
    this.enqueue({
      id: this.id(),
      type: 'identity',
      name: IDENTITY_EVENT,
      userId: link.userId,
      anonymousId: link.anonymousId,
      properties: {},
      occurredAt: link.occurredAt ?? this.config.now(),
    });
  }

  private enqueue(envelope: Envelope): void {
    if (this.closed) throw new SdkError(ERROR_CODES.UNAVAILABLE, 'tracker is closed');
    if (this.queue.length >= this.config.maxQueue) {
      this.queue.shift();
      this.lost += 1;
      this.config.logger.warn('analytics queue full, oldest event dropped', {
        maxQueue: this.config.maxQueue,
      });
    }
    this.queue.push(envelope);
    if (this.queue.length >= this.config.batchSize) void this.flush();
    else if (this.timer === undefined && this.config.flushIntervalMs > 0)
      this.timer = this.timers.set(() => void this.flush(), this.config.flushIntervalMs);
  }

  flush(): Promise<void> {
    if (this.timer !== undefined) {
      this.timers.clear(this.timer);
      this.timer = undefined;
    }
    const batches: Envelope[][] = [];
    while (this.queue.length > 0) batches.push(this.queue.splice(0, this.config.batchSize));
    // Deliveries are serialised so the sink sees batches in order.
    this.inFlight = this.inFlight.then(async () => {
      for (const batch of batches) await this.deliver(batch);
    });
    return this.inFlight;
  }

  private async deliver(batch: Envelope[]): Promise<void> {
    try {
      await withRetry(() => this.deps.sink.deliver(batch), this.config.retry, this.retryDeps);
    } catch (error) {
      this.lost += batch.length;
      const reason = isSdkError(error) ? error.code : ERROR_CODES.SINK_FAILED;
      this.config.logger.error('analytics batch lost', {
        sink: this.deps.sink.name,
        size: batch.length,
        reason,
      });
    }
  }

  async close(): Promise<void> {
    await this.flush();
    this.closed = true;
    await this.deps.sink.close?.();
  }
}
