import { Queue, Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import {
  JOB_BACKOFF_BASE_MS,
  JOB_KEEP_FAILED,
  JOB_KEY_PREFIX,
  JOB_LOCK_DURATION_MS,
  JOB_MAX_ATTEMPTS,
  JOB_QUEUE_NAME,
  JOB_SERVER_EVENTS,
  JOB_WORKER_CONCURRENCY,
} from '../constants/jobs';
import type { Logger } from '../utils/logger';
import type { JobHandler, JobScheduler } from './jobs';

export interface BullJobSchedulerOptions {
  /** The shared connection: queue commands use it, workers get their own blocking duplicate. */
  readonly redis: Redis;
  readonly logger: Logger;
  /** Called once per failed attempt and again when the retries are used up. */
  readonly onFailure?: (event: {
    name: string;
    id: string;
    attempt: number;
    exhausted: boolean;
    reason: string;
  }) => void;
  readonly queueName?: string;
  /** Overrides the retry policy (tests use tiny delays). */
  readonly retry?: { readonly attempts: number; readonly backoffMs: number };
  readonly now?: () => Date;
}

type Data = Readonly<Record<string, string | number | boolean>>;

export const createBullJobScheduler = (options: BullJobSchedulerOptions): JobScheduler => {
  const {
    redis,
    logger,
    onFailure,
    queueName = JOB_QUEUE_NAME,
    now = () => new Date(),
    retry = { attempts: JOB_MAX_ATTEMPTS, backoffMs: JOB_BACKOFF_BASE_MS },
  } = options;
  const common = { prefix: JOB_KEY_PREFIX };
  const queue = new Queue(queueName, {
    ...common,
    connection: redis,
    defaultJobOptions: {
      attempts: retry.attempts,
      backoff: { type: 'exponential', delay: retry.backoffMs },
      // Finished jobs vanish so the same deterministic id can be queued again later.
      removeOnComplete: true,
      removeOnFail: { count: JOB_KEEP_FAILED },
    },
  });
  queue.on('error', (err) => {
    logger.warn({ err }, 'job queue error');
  });
  let worker: Worker | undefined;
  let workerConnection: Redis | undefined;

  return {
    async schedule({ id, name, data, runAt }) {
      const existing = await queue.getJob(id);
      if (existing !== undefined) {
        const state = await existing.getState();
        if (state === 'delayed' || state === 'waiting' || state === 'active') return false;
        // A failed job still holds the id: drop it so a corrected plan can run.
        await existing.remove();
      }
      await queue.add(name, data ?? {}, {
        jobId: id,
        delay: Math.max(0, runAt.getTime() - now().getTime()),
      });
      return true;
    },

    async remove(id) {
      const job = await queue.getJob(id);
      if (job === undefined) return false;
      const state = await job.getState();
      if (state === 'active') return false;
      await job.remove();
      return true;
    },

    async repeat({ id, name, cron, timeZone }) {
      await queue.upsertJobScheduler(id, { pattern: cron, tz: timeZone }, { name, data: {} });
    },

    async failed(limit) {
      const jobs = await queue.getFailed(0, Math.max(0, limit - 1));
      return jobs
        .sort((a, b) => (b.finishedOn ?? 0) - (a.finishedOn ?? 0))
        .map((job) => ({
          id: job.id ?? '',
          name: job.name,
          attempts: job.attemptsMade,
          reason: job.failedReason,
          failedAt: job.finishedOn === undefined ? null : new Date(job.finishedOn),
        }));
    },

    work(handlers: Readonly<Record<string, JobHandler>>) {
      if (worker !== undefined) throw new Error('Job worker already started');
      // Blocking commands must not hit the shared client's command timeout or retry cap.
      workerConnection = redis.duplicate({ maxRetriesPerRequest: null, commandTimeout: undefined });
      worker = new Worker(
        queueName,
        async (job: Job) => {
          const handler = handlers[job.name];
          if (handler === undefined) {
            throw new Error(`No handler for job "${job.name}"`);
          }
          await handler({
            id: job.id ?? '',
            name: job.name,
            data: job.data as Data,
            attempt: job.attemptsMade + 1,
          });
        },
        {
          ...common,
          connection: workerConnection,
          concurrency: JOB_WORKER_CONCURRENCY,
          lockDuration: JOB_LOCK_DURATION_MS,
        },
      );
      worker.on('error', (err) => {
        logger.warn({ err }, 'job worker error');
      });
      worker.on('failed', (job, err) => {
        if (job === undefined) return;
        const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
        const event = {
          name: job.name,
          id: job.id ?? '',
          attempt: job.attemptsMade,
          exhausted,
          reason: err.message,
        };
        logger[exhausted ? 'error' : 'warn'](
          { ...event, event: exhausted ? JOB_SERVER_EVENTS.exhausted : JOB_SERVER_EVENTS.failed },
          'job failed',
        );
        onFailure?.(event);
      });
      return worker.waitUntilReady().then(() => undefined);
    },

    async close() {
      await worker?.close();
      worker = undefined;
      if (workerConnection !== undefined) {
        workerConnection.disconnect();
        workerConnection = undefined;
      }
      await queue.close();
    },
  };
};
