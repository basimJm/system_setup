import { FakeEmailSender, FakePushSender } from './adapters/fake';
import { MemoryIdempotencyStore } from './adapters/memory-idempotency';
import { resolveConfig, type NotificationsOptions } from './config/options';
import { NotifierService } from './notifier';
import type { EmailSender, PushSender } from './types';

/** A notifier plus the senders it runs on (fake senders expose what was sent). */
export interface Notifications extends NotifierService {
  readonly pushSender: PushSender | undefined;
  readonly emailSender: EmailSender | undefined;
}

/** The factory: `fake` channels get recording senders; `custom` channels use the injected ones. */
export const createNotifications = (options: NotificationsOptions): Notifications => {
  const config = resolveConfig(options);
  const pushSender =
    config.push === undefined
      ? undefined
      : config.push === 'fake'
        ? new FakePushSender()
        : config.pushSender;
  const emailSender =
    config.email === undefined
      ? undefined
      : config.email === 'fake'
        ? new FakeEmailSender()
        : config.emailSender;
  const service = new NotifierService(config, {
    ...(pushSender ? { pushSender } : {}),
    ...(emailSender ? { emailSender } : {}),
    idempotencyStore: config.idempotencyStore ?? new MemoryIdempotencyStore(config.now),
  });
  return Object.assign(service, { pushSender, emailSender });
};
