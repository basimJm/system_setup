import { PERIODIC_JOBS } from '../constants/jobs';
import { MS_PER_DAY } from '../constants/time';
import type { SettingsService } from '../domain/settings';
import type { NotificationsRepository } from '../repositories/notifications.repository';
import type { Logger } from '../utils/logger';
import type { JobHandler, JobScheduler } from './jobs';

export interface PeriodicJobsDeps {
  readonly scheduler: Pick<JobScheduler, 'repeat'>;
  readonly settings: Pick<SettingsService, 'get'>;
  readonly notifications: Pick<NotificationsRepository, 'deleteReadBefore'>;
  /** The admin overview tick; without it the job does nothing. */
  readonly overviewTick?: () => void;
  readonly logger: Logger;
  readonly now?: () => Date;
}

export interface PeriodicJobs {
  /** The processors, keyed by job name, for `JobScheduler.work`. */
  readonly handlers: Readonly<Record<string, JobHandler>>;
  /** Registers every cron schedule in the business time zone (replaces earlier ones by id). */
  register(): Promise<void>;
}

/** Recurring work (docs/BUSINESS_DOMAIN.md §9). Add a job: a constant in `PERIODIC_JOBS` + a handler here. */
export const createPeriodicJobs = (deps: PeriodicJobsDeps): PeriodicJobs => {
  const { scheduler, settings, notifications, logger } = deps;
  const now = deps.now ?? ((): Date => new Date());
  const report = (job: string, outcome: Record<string, number>): void => {
    logger.info({ job, ...outcome }, 'periodic job finished');
  };

  const handlers: Record<string, JobHandler> = {
    [PERIODIC_JOBS.notificationsPurge.name]: async () => {
      const retentionDays = await settings.get('notifications.retentionDays');
      const before = new Date(now().getTime() - retentionDays * MS_PER_DAY);
      report(PERIODIC_JOBS.notificationsPurge.name, {
        deleted: await notifications.deleteReadBefore(before),
      });
    },
    [PERIODIC_JOBS.overviewTick.name]: () => {
      deps.overviewTick?.();
      return Promise.resolve();
    },
  };

  return {
    handlers,
    async register() {
      const timeZone = await settings.get('timezone');
      for (const job of Object.values(PERIODIC_JOBS)) {
        await scheduler.repeat({ id: job.name, name: job.name, cron: job.cron, timeZone });
      }
    },
  };
};
