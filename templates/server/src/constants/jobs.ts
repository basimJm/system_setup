import { MS_PER_MINUTE, MS_PER_SECOND } from './time';

/** Background jobs (docs/BUSINESS_DOMAIN.md §9). */
export const JOB_QUEUE_NAME = '__SYSTEM_SLUG__-jobs';
/** Keeps BullMQ keys apart from the server's own `lock:`/`rate:` keys. */
export const JOB_KEY_PREFIX = 'jobs';
/** BullMQ forbids `:` in custom job ids, so logical names (`item.reminder.{id}`) use a dot. */
export const JOB_ID_SEPARATOR = '.';

/** A failed job is retried with exponential backoff, then kept visible in the failed set. */
export const JOB_MAX_ATTEMPTS = 5;
export const JOB_BACKOFF_BASE_MS = 5 * MS_PER_SECOND;
/** How many finished/failed jobs stay in Redis: failures for inspection, successes not at all. */
export const JOB_KEEP_FAILED = 500;
export const JOB_WORKER_CONCURRENCY = 5;
/** A job that ran longer than this is considered stalled and picked up again. */
export const JOB_LOCK_DURATION_MS = 5 * MS_PER_MINUTE;

export const JOB_SERVER_EVENTS = {
  failed: 'job.failed',
  exhausted: 'job.exhausted',
} as const;

/** Recurring jobs. Cron is evaluated in the business time zone (`settings.timezone`). */
export const PERIODIC_JOBS = {
  /** Deletes read notifications older than `notifications.retentionDays`. */
  notificationsPurge: { name: 'periodic.notifications-purge', cron: '0 3 * * *' },
  /** Tells open admin panels to refresh the overview (`overview.tick`). */
  overviewTick: { name: 'periodic.overview-tick', cron: '* * * * *' },
} as const;
