import { PERIODIC_JOBS } from '../src/constants/jobs';
import type { RecurringJob } from '../src/jobs/jobs';
import { createPeriodicJobs } from '../src/jobs/periodicJobs';
import { createLogger } from '../src/utils/logger';
import { fakeSettings } from './helpers/rig';

const logger = createLogger({ level: 'silent' });

describe('periodic jobs', () => {
  it('registers every cron in the business time zone and runs the handlers', async () => {
    const registered: RecurringJob[] = [];
    const deleted: Date[] = [];
    let ticks = 0;
    const now = new Date('2026-10-12T10:00:00.000Z');
    const jobs = createPeriodicJobs({
      scheduler: {
        repeat: (job) => {
          registered.push(job);
          return Promise.resolve();
        },
      },
      settings: fakeSettings({ timezone: 'Etc/GMT-3', 'notifications.retentionDays': 10 }),
      notifications: {
        deleteReadBefore: (before) => {
          deleted.push(before);
          return Promise.resolve(3);
        },
      },
      overviewTick: () => {
        ticks += 1;
      },
      logger,
      now: () => now,
    });
    await jobs.register();
    expect(registered.map((j) => j.id).sort()).toEqual(
      Object.values(PERIODIC_JOBS)
        .map((j) => j.name)
        .sort(),
    );
    expect(registered.every((j) => j.timeZone === 'Etc/GMT-3')).toBe(true);
    expect(Object.keys(jobs.handlers).sort()).toEqual(registered.map((j) => j.name).sort());
    const run = (name: string): Promise<void> => {
      const handler = jobs.handlers[name];
      if (handler === undefined) throw new Error(`no handler ${name}`);
      return handler({ id: name, name, data: {}, attempt: 1 });
    };
    await run(PERIODIC_JOBS.notificationsPurge.name);
    expect(deleted[0]).toEqual(new Date('2026-10-02T10:00:00.000Z'));
    await run(PERIODIC_JOBS.overviewTick.name);
    expect(ticks).toBe(1);
  });
});
