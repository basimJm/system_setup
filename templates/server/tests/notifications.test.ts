import request from 'supertest';
import { createApp } from '../src/app';
import { createInboxService } from '../src/domain/notifications/inbox.service';
import { createNotificationService } from '../src/domain/notifications/notifications.service';
import { createRecipientSource } from '../src/domain/notifications/recipients';
import { requireAuth } from '../src/middlewares/auth';
import { FakeNotifier } from '../src/providers/notifier';
import { CustomersRepository, MembersRepository } from '../src/repositories/identity.repository';
import { NotificationsRepository } from '../src/repositories/notifications.repository';
import { MESSAGES } from '../src/utils/i18n';
import { createLogger } from '../src/utils/logger';
import { createFakeModel } from './helpers/fakeModel';
import { SECRET, bearer, fakeSettings, recordingAccess } from './helpers/rig';
import { Types } from 'mongoose';

const logger = createLogger({ level: 'silent' });
const models = {
  notifications: createFakeModel(),
  customers: createFakeModel(),
  members: createFakeModel(),
};
const notifier = new FakeNotifier();
const access = recordingAccess();
const repository = new NotificationsRepository(models.notifications.model as never);
const service = createNotificationService({
  notifications: repository,
  recipients: createRecipientSource({
    customers: new CustomersRepository(models.customers.model as never),
    members: new MembersRepository(models.members.model as never),
  }),
  notifier,
  access,
  logger,
});
const inbox = createInboxService({ notifications: repository, settings: fakeSettings(), access });
const app = createApp({
  logger,
  services: {
    inbox,
    customerAuth: { service: undefined as never, authenticate: requireAuth('customer', SECRET) },
  },
});
const customerId = new Types.ObjectId();

beforeEach(() => {
  for (const model of Object.values(models)) model.docs.length = 0;
  access.calls.length = 0;
  notifier.pushes.length = 0;
  models.customers.docs.push({
    _id: customerId,
    status: 'ACTIVE',
    language: 'ar',
    pushToken: 'tok-1',
  });
});

describe('notification service', () => {
  it('stores both languages, pushes in the recipient language, de-duplicates and bumps the unread badge', async () => {
    const stored = await service.notify({
      recipient: { type: 'CUSTOMER', id: customerId.toHexString() },
      event: 'account.welcome',
      params: { name: 'Lina' },
      dedupeKey: 'welcome:1',
    });
    expect(stored?.title).toEqual({
      ar: MESSAGES.ar['notifications.account.welcome.title'],
      en: MESSAGES.en['notifications.account.welcome.title'],
    });
    expect(stored?.body.en).toContain('Lina');
    expect(notifier.pushes[0]?.message.title).toBe(
      MESSAGES.ar['notifications.account.welcome.title'],
    );
    expect(notifier.pushes[0]?.target).toEqual({ tokens: ['tok-1'] });
    expect(models.notifications.docs[0]).toMatchObject({ pushSent: true, pushResult: 'SENT' });
    expect(access.calls).toEqual([`unread:customer:${customerId.toHexString()}:1`]);
    expect(await service.unreadCount('CUSTOMER', customerId.toHexString())).toBe(1);
  });

  it('records NO_TOKEN without a device, FAILED when the push fails, and never throws', async () => {
    delete models.customers.docs[0]?.['pushToken'];
    await service.notify({
      recipient: { type: 'CUSTOMER', id: customerId.toHexString() },
      event: 'account.welcome',
      dedupeKey: 'w:2',
    });
    expect(models.notifications.docs[0]).toMatchObject({ pushSent: false, pushResult: 'NO_TOKEN' });
    Object.assign(models.customers.docs[0] ?? {}, { pushToken: 'bad' });
    notifier.markTokenInvalid('bad');
    await service.notify({
      recipient: { type: 'CUSTOMER', id: customerId.toHexString() },
      event: 'account.welcome',
      dedupeKey: 'w:3',
    });
    expect(models.notifications.docs[1]).toMatchObject({ pushResult: 'FAILED' });
    expect(
      await service.notify({
        recipient: { type: 'MEMBER', id: new Types.ObjectId().toHexString() },
        event: 'account.welcome',
        dedupeKey: 'w:4',
      }),
    ).toBeNull();
    expect(
      await service.notify({
        recipient: { type: 'CUSTOMER', id: 'not-an-id' },
        event: 'account.welcome',
        dedupeKey: 'w:5',
      }),
    ).toBeNull();
  });
});

describe('inbox over HTTP', () => {
  it('lists in the request language with pagination, counts and marks read (own ids only)', async () => {
    const id = customerId.toHexString();
    await service.notify({
      recipient: { type: 'CUSTOMER', id },
      event: 'account.welcome',
      params: { name: 'A' },
      dedupeKey: 'a',
    });
    await service.notify({
      recipient: { type: 'CUSTOMER', id },
      event: 'item.restored_by_admin',
      params: { title: 'Lamp' },
      dedupeKey: 'b',
    });
    const list = await request(app)
      .get('/customer/v1/notifications?pageSize=1')
      .set(bearer('CUSTOMER', id))
      .set('Accept-Language', 'en');
    expect(list.status).toBe(200);
    const body = list.body as {
      data: { id: string; title: string; isRead: boolean }[];
      meta: { total: number };
    };
    expect(body.meta.total).toBe(2);
    expect([
      MESSAGES.en['notifications.item.restored_by_admin.title'],
      MESSAGES.en['notifications.account.welcome.title'],
    ]).toContain(body.data[0]?.title);
    const unread = await request(app)
      .get('/customer/v1/notifications/unread-count')
      .set(bearer('CUSTOMER', id));
    expect((unread.body as { data: { unread: number } }).data.unread).toBe(2);
    const foreign = new Types.ObjectId().toHexString();
    const read = await request(app)
      .post('/customer/v1/notifications/read')
      .set(bearer('CUSTOMER', id))
      .send({ ids: [body.data[0]?.id, foreign] });
    expect((read.body as { data: unknown }).data).toEqual({ marked: 1, unread: 1 });
    expect(
      (
        await request(app)
          .get('/customer/v1/notifications?from=2026-13-01')
          .set(bearer('CUSTOMER', id))
      ).status,
    ).toBe(400);
    expect((await request(app).get('/customer/v1/notifications')).status).toBe(401);
  });
});
