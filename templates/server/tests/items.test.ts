import request from 'supertest';
import { Types } from 'mongoose';
import { createApp } from '../src/app';
import { createAuditWriter } from '../src/domain/audit';
import { createItemsService, type AdminItemView } from '../src/domain/items/items.service';
import { createNotificationService } from '../src/domain/notifications/notifications.service';
import { createUploadsService } from '../src/domain/uploads/uploads.service';
import { requireAuth } from '../src/middlewares/auth';
import { loadMember } from '../src/middlewares/permission';
import { FakeNotifier } from '../src/providers/notifier';
import { FakeStorageProvider } from '../src/providers/storage';
import { AuditLogsRepository } from '../src/repositories/auditLogs.repository';
import { MembersRepository } from '../src/repositories/identity.repository';
import { ItemsRepository } from '../src/repositories/items.repository';
import { NotificationsRepository } from '../src/repositories/notifications.repository';
import { UploadsRepository } from '../src/repositories/uploads.repository';
import { createLogger } from '../src/utils/logger';
import { createFakeModel } from './helpers/fakeModel';
import { SECRET, bearer, fakeSettings, newId, recordingAccess } from './helpers/rig';

const logger = createLogger({ level: 'silent' });
const models = {
  items: createFakeModel(),
  uploads: createFakeModel(),
  audit: createFakeModel(),
  notifications: createFakeModel(),
  members: createFakeModel(),
};
const settingsValues: Record<string, unknown> = {};
const storage = new FakeStorageProvider();
const notifier = new FakeNotifier();
const access = recordingAccess();
const events: { kind: string; item: AdminItemView }[] = [];
const customerId = newId();
const tenantId = new Types.ObjectId();
const recipients = {
  findRecipient: (type: 'CUSTOMER' | 'MEMBER', id: string) =>
    Promise.resolve({ type, id, language: 'en' as const, pushToken: 'push-token' }),
};
const uploads = createUploadsService({
  uploads: new UploadsRepository(models.uploads.model as never),
  storage,
  settings: fakeSettings(),
});
const service = createItemsService({
  items: new ItemsRepository(models.items.model as never),
  settings: fakeSettings(settingsValues),
  uploads,
  publicUrl: (key) => storage.getPublicUrl(key),
  audit: createAuditWriter(new AuditLogsRepository(models.audit.model as never)),
  notifications: createNotificationService({
    notifications: new NotificationsRepository(models.notifications.model as never),
    recipients,
    notifier,
    access,
    logger,
  }),
  events: {
    created: (item) => events.push({ kind: 'created', item }),
    updated: (item) => events.push({ kind: 'updated', item }),
  },
});
const members = new MembersRepository(models.members.model as never);
const app = createApp({
  logger,
  services: {
    items: service,
    customerAuth: { service: undefined as never, authenticate: requireAuth('customer', SECRET) },
    merchantAuth: {
      service: undefined as never,
      guard: [requireAuth('merchant', SECRET), loadMember(members)],
    },
    adminGuard: requireAuth('admin', SECRET),
  },
});
const addMember = (role: 'OWNER' | 'STAFF', permissions: string[]): string => {
  const _id = new Types.ObjectId();
  models.members.docs.push({ _id, tenantId, role, permissions, active: true });
  return _id.toHexString();
};
interface Body {
  data: {
    id: string;
    status: string;
    imageUrl: string | null;
    title: string;
    owner?: { id: string };
  };
  meta?: { total: number };
  error: { code: string; details: { field: string }[] };
}
const bodyOf = (res: { body: unknown }): Body => res.body as Body;
const owner = { type: 'CUSTOMER' as const, id: customerId };

beforeEach(() => {
  for (const model of Object.values(models)) model.docs.length = 0;
  events.length = 0;
  access.calls.length = 0;
  delete settingsValues['items.maxPerOwner'];
});

describe('items service', () => {
  it("creates, lists, updates and archives the owner's items; other owners see nothing", async () => {
    const created = await service.create(owner, { title: 'Chair', tags: ['wood'] });
    expect(created).toMatchObject({ title: 'Chair', status: 'ACTIVE', imageUrl: null });
    expect(events[0]).toMatchObject({ kind: 'created', item: { owner } });
    const stranger = { type: 'CUSTOMER' as const, id: newId() };
    await expect(service.get(stranger, created.id)).rejects.toMatchObject({
      code: 'ITEM_NOT_FOUND',
    });
    expect((await service.list(stranger, {}, { page: 1, pageSize: 10 })).meta.total).toBe(0);
    const updated = await service.update(owner, created.id, { title: 'Oak chair' });
    expect(updated.title).toBe('Oak chair');
    const archived = await service.archive(owner, created.id);
    expect(archived.status).toBe('ARCHIVED');
    await expect(service.update(owner, created.id, { title: 'x' })).rejects.toMatchObject({
      code: 'ITEM_ARCHIVED',
    });
    expect(
      (await service.list(owner, { status: 'ARCHIVED' }, { page: 1, pageSize: 10 })).items,
    ).toHaveLength(1);
  });

  it('enforces items.maxPerOwner on active items', async () => {
    settingsValues['items.maxPerOwner'] = 1;
    await service.create(owner, { title: 'One' });
    await expect(service.create(owner, { title: 'Two' })).rejects.toMatchObject({
      code: 'ITEM_LIMIT_REACHED',
    });
  });

  it('accepts only a confirmed ITEM_IMAGE upload of the same owner', async () => {
    await expect(
      service.create(owner, { title: 'Pic', imageKey: 'items/x/1.jpg' }),
    ).rejects.toMatchObject({ code: 'UPLOAD_INVALID' });
    const actor = {
      scope: 'customer' as const,
      ownerType: 'CUSTOMER' as const,
      ownerId: customerId,
    };
    const presigned = await uploads.presign({
      purpose: 'ITEM_IMAGE',
      contentType: 'image/jpeg',
      size: 10,
      actor,
    });
    storage.simulateUpload(presigned.key, { contentType: 'image/jpeg', size: 10 });
    await uploads.confirm({ key: presigned.key, actor });
    const item = await service.create(owner, { title: 'Pic', imageKey: presigned.key });
    expect(item.imageUrl).toContain(presigned.key);
    await expect(
      service.create(
        { type: 'CUSTOMER', id: newId() },
        { title: 'Steal', imageKey: presigned.key },
      ),
    ).rejects.toMatchObject({ code: 'UPLOAD_INVALID' });
  });

  it('admin archive needs a reason, writes the audit log, notifies and pushes the owner, restore too', async () => {
    const created = await service.create(owner, { title: 'Chair' });
    const context = {
      adminId: newId(),
      reason: 'Reported content',
      ip: '203.0.113.7',
      userAgent: 'jest',
    };
    const archived = await service.adminArchive(created.id, context);
    expect(archived).toMatchObject({
      status: 'ARCHIVED',
      archivedReason: 'Reported content',
      owner,
    });
    expect(models.audit.docs[0]).toMatchObject({
      action: 'ITEM_ARCHIVE',
      entityType: 'item',
      entityId: created.id,
      reason: 'Reported content',
    });
    expect(models.notifications.docs[0]).toMatchObject({
      event: 'item.archived_by_admin',
      recipientType: 'CUSTOMER',
      pushSent: true,
    });
    expect(notifier.pushes.at(-1)?.message.body).toContain('Reported content');
    expect(access.calls).toContain(`unread:customer:${customerId}:1`);
    await expect(service.adminArchive(created.id, context)).rejects.toMatchObject({
      code: 'ITEM_ARCHIVED',
    });
    const restored = await service.adminRestore(created.id, context);
    expect(restored.status).toBe('ACTIVE');
    expect(models.audit.docs[1]).toMatchObject({ action: 'ITEM_RESTORE' });
    expect(
      (await service.adminList({ status: 'ACTIVE' }, { page: 1, pageSize: 10 })).meta.total,
    ).toBe(1);
  });
});

describe('items over HTTP', () => {
  it('customer: full CRUD with the envelope, pagination meta and validation', async () => {
    const auth = bearer('CUSTOMER', customerId);
    const bad = await request(app).post('/customer/v1/items').set(auth).send({ title: '' });
    expect(bad.status).toBe(400);
    expect(bodyOf(bad).error.details[0]?.field).toBe('body.title');
    const created = await request(app)
      .post('/customer/v1/items')
      .set(auth)
      .send({ title: 'Lamp', tags: ['light'] });
    expect(created.status).toBe(201);
    const id = bodyOf(created).data.id;
    const list = await request(app).get('/customer/v1/items?tag=light').set(auth);
    expect(list.status).toBe(200);
    expect(bodyOf(list).meta).toEqual({ page: 1, pageSize: 10, total: 1 });
    const patched = await request(app)
      .patch(`/customer/v1/items/${id}`)
      .set(auth)
      .send({ title: 'Desk lamp' });
    expect(bodyOf(patched).data.title).toBe('Desk lamp');
    const archived = await request(app).post(`/customer/v1/items/${id}/archive`).set(auth);
    expect(bodyOf(archived).data.status).toBe('ARCHIVED');
    expect((await request(app).get('/customer/v1/items')).status).toBe(401);
    expect(
      (await request(app).get(`/customer/v1/items/${id}`).set(bearer('CUSTOMER', newId()))).status,
    ).toBe(404);
  });

  it('merchant: staff need ITEMS_VIEW to read and ITEMS_MANAGE to write; the owner has both; items are per tenant', async () => {
    const ownerId = addMember('OWNER', []);
    const viewer = addMember('STAFF', ['ITEMS_VIEW']);
    const nobody = addMember('STAFF', []);
    const created = await request(app)
      .post('/merchant/v1/items')
      .set(bearer('MEMBER', ownerId))
      .send({ title: 'Stock' });
    expect(created.status).toBe(201);
    expect(
      (await request(app).get('/merchant/v1/items').set(bearer('MEMBER', viewer))).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post('/merchant/v1/items')
          .set(bearer('MEMBER', viewer))
          .send({ title: 'x' })
      ).status,
    ).toBe(403);
    const denied = await request(app).get('/merchant/v1/items').set(bearer('MEMBER', nobody));
    expect(denied.status).toBe(403);
    expect(bodyOf(denied).error.code).toBe('PERMISSION_DENIED');
    expect(
      (await request(app).get('/merchant/v1/items').set(bearer('CUSTOMER', ownerId))).status,
    ).toBe(403);
    expect(models.items.docs[0]?.['ownerId']?.toString()).toBe(tenantId.toHexString());
  });

  it('admin: lists everything, archives with a reason only', async () => {
    const created = await request(app)
      .post('/customer/v1/items')
      .set(bearer('CUSTOMER', customerId))
      .send({ title: 'Lamp' });
    const id = bodyOf(created).data.id;
    const admin = bearer('ADMIN', newId());
    const all = await request(app)
      .get(`/admin/v1/items?ownerType=CUSTOMER&ownerId=${customerId}`)
      .set(admin);
    expect(bodyOf(all).meta?.total).toBe(1);
    const noReason = await request(app).post(`/admin/v1/items/${id}/archive`).set(admin).send({});
    expect(noReason.status).toBe(400);
    const archived = await request(app)
      .post(`/admin/v1/items/${id}/archive`)
      .set(admin)
      .send({ reason: 'Duplicate listing' });
    expect(archived.status).toBe(200);
    expect(bodyOf(archived).data.owner?.id).toBe(customerId);
    expect(
      (await request(app).get(`/admin/v1/items/${id}`).set(bearer('CUSTOMER', customerId))).status,
    ).toBe(403);
  });
});
