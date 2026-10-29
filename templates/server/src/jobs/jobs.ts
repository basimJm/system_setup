import { JOB_ID_SEPARATOR } from '../constants/jobs';

/**
 * What the rest of the server sees of the background-job system: a small port, so
 * domain code never imports BullMQ and tests can use an in-memory fake.
 */
export interface JobDefinition {
  /** Deterministic id (`item.reminder.<itemId>`): the same logical job is never queued twice. */
  readonly id: string;
  /** Selects the handler. */
  readonly name: string;
  readonly data?: Readonly<Record<string, string | number | boolean>>;
}

export interface DelayedJob extends JobDefinition {
  /** When to run. A past time runs at once. */
  readonly runAt: Date;
}

export interface RecurringJob {
  /** Stable id: registering the same id again replaces the schedule. */
  readonly id: string;
  readonly name: string;
  /** Standard 5-field cron, evaluated in `timeZone`. */
  readonly cron: string;
  readonly timeZone: string;
}

export interface FailedJob {
  readonly id: string;
  readonly name: string;
  readonly attempts: number;
  readonly reason: string;
  readonly failedAt: Date | null;
}

export type JobHandler = (job: {
  readonly id: string;
  readonly name: string;
  readonly data: Readonly<Record<string, string | number | boolean>>;
  readonly attempt: number;
}) => Promise<void>;

export interface JobScheduler {
  /** Queues a job to run at `runAt`; an id that is already waiting is left untouched (returns false). */
  schedule(job: DelayedJob): Promise<boolean>;
  /** Removes a waiting job; false when it was not waiting (done, running or unknown). */
  remove(id: string): Promise<boolean>;
  /** Registers (or replaces) a cron schedule. */
  repeat(job: RecurringJob): Promise<void>;
  /** Jobs that used up every retry, newest first: the dead-letter view. */
  failed(limit: number): Promise<FailedJob[]>;
  /** Starts processing; handlers are picked by job name. Returns a stop function. */
  work(handlers: Readonly<Record<string, JobHandler>>): Promise<void>;
  close(): Promise<void>;
}

export const jobId = (...parts: readonly (string | number)[]): string => {
  const texts = parts.map(String);
  if (texts.length === 0 || texts.some((part) => part === '' || part.includes(JOB_ID_SEPARATOR))) {
    throw new RangeError(`A job id needs non-empty parts without "${JOB_ID_SEPARATOR}"`);
  }
  return texts.join(JOB_ID_SEPARATOR);
};
