import { Types } from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app';
import { UPLOAD_POLICIES, UPLOAD_PURPOSES, UPLOAD_URL_TTL_SEC } from '../src/constants/uploads';
import { createUploadsService } from '../src/domain/uploads/uploads.service';
import { requireAuth } from '../src/middlewares/auth';
import { loadMember } from '../src/middlewares/permission';
import { FakeStorageProvider } from '../src/providers/storage';
import { MembersRepository } from '../src/repositories/identity.repository';
import { UploadsRepository } from '../src/repositories/uploads.repository';
import { createLogger } from '../src/utils/logger';
import { createFakeModel } from './helpers/fakeModel';
import { SECRET, bearer, fakeSettings, newId } from './helpers/rig';

const logger = createLogger({ level: 'silent' });
let clock = new Date('2026-10-12T10:00:00.000Z');
const uploadsModel = createFakeModel();
const members = createFakeModel();
const storage = new FakeStorageProvider({ now: () => clock });
let counter = 0;
const service = createUploadsService({
  uploads: new UploadsRepository(uploadsModel.model as never),
  storage,
  settings: fakeSettings(),
  now: () => clock,
  newId: () => `id${String((counter += 1))}`,
});
const app = createApp({
  logger,
  services: {
    uploads: service,
    adminGuard: requireAuth('admin', SECRET),
    customerAuth: { service: undefined as never, authenticate: requireAuth('customer', SECRET) },
    merchantAuth: {
      service: undefined as never,
      guard: [
        requireAuth('merchant', SECRET),
        loadMember(new MembersRepository(members.model as never)),
      ],
    },
  },
});
interface Body {
  data: {
    key: string;
    url: string | null;
    upload: { method: string; headers: Record<string, string> };
  };
  error: { code: string };
}
const bodyOf = (res: { body: unknown }): Body => res.body as Body;
const tenantId = new Types.ObjectId();
const addMember = (role: string, permissions: string[]): string => {
  const _id = new Types.ObjectId();
  members.docs.push({ _id, tenantId, role, permissions, active: true });
  return _id.toHexString();
};
const JPEG = { contentType: 'image/jpeg', size: 1_000 };

beforeEach(() => {
  uploadsModel.docs.length = 0;
  members.docs.length = 0;
  clock = new Date('2026-10-12T10:00:00.000Z');
});

describe('upload policies', () => {
  it('cover every purpose; documents are private, images public', () => {
    expect(Object.keys(UPLOAD_POLICIES).sort()).toEqual([...UPLOAD_PURPOSES].sort());
    for (const purpose of UPLOAD_PURPOSES) {
      expect(UPLOAD_POLICIES[purpose].visibility).toBe(
        UPLOAD_POLICIES[purpose].kind === 'document' ? 'PRIVATE' : 'PUBLIC',
      );
    }
  });
});

describe('presign and confirm', () => {
  it('customer: server-chosen key, PENDING record, pinned type and size, then confirm → CDN URL', async () => {
    const id = newId();
    const res = await request(app)
      .post('/customer/v1/uploads/presign')
      .set(bearer('CUSTOMER', id))
      .send({ purpose: 'CUSTOMER_AVATAR', ...JPEG });
    expect(res.status).toBe(200);
    expect(bodyOf(res).data.key).toBe(`customers/${id}/id1.jpg`);
    expect(bodyOf(res).data.upload.headers['Content-Type']).toBe('image/jpeg');
    expect(uploadsModel.docs[0]).toMatchObject({
      status: 'PENDING',
      ownerType: 'CUSTOMER',
      ownerId: id,
      maxBytes: 1_000,
      expiresAt: new Date(clock.getTime() + UPLOAD_URL_TTL_SEC * 1_000),
    });
    const key = bodyOf(res).data.key;
    const early = await request(app)
      .post('/customer/v1/uploads/confirm')
      .set(bearer('CUSTOMER', id))
      .send({ key });
    expect(early.status).toBe(400);
    storage.simulateUpload(key, { contentType: 'image/jpeg', size: 900 });
    const confirmed = await request(app)
      .post('/customer/v1/uploads/confirm')
      .set(bearer('CUSTOMER', id))
      .send({ key });
    expect(confirmed.status).toBe(200);
    expect(bodyOf(confirmed).data.url).toContain(key);
    expect(uploadsModel.docs[0]?.['status']).toBe('CONFIRMED');
    expect(
      (
        await request(app)
          .post('/customer/v1/uploads/confirm')
          .set(bearer('CUSTOMER', newId()))
          .send({ key })
      ).status,
    ).toBe(404);
  });

  it('refuses purposes of other apps, wrong types, oversized files and wrong uploaded content', async () => {
    const auth = bearer('CUSTOMER', newId());
    const post = (body: object): request.Test =>
      request(app).post('/customer/v1/uploads/presign').set(auth).send(body);
    expect((await post({ purpose: 'PRIVATE_DOCUMENT', ...JPEG })).status).toBe(403);
    expect(
      bodyOf(await post({ purpose: 'CUSTOMER_AVATAR', contentType: 'application/pdf', size: 10 }))
        .error.code,
    ).toBe('UPLOAD_INVALID');
    expect(
      bodyOf(
        await post({ purpose: 'CUSTOMER_AVATAR', contentType: 'image/png', size: 11 * 1_048_576 }),
      ).error.code,
    ).toBe('UPLOAD_TOO_LARGE');
    const ok = await post({ purpose: 'CUSTOMER_AVATAR', ...JPEG });
    const key = bodyOf(ok).data.key;
    storage.simulateUpload(key, { contentType: 'image/png', size: 10 });
    const confirmed = await request(app)
      .post('/customer/v1/uploads/confirm')
      .set(auth)
      .send({ key });
    expect(bodyOf(confirmed).error.code).toBe('UPLOAD_INVALID');
    expect(uploadsModel.docs.at(-1)?.['status']).toBe('REJECTED');
    expect(storage.has(key)).toBe(false);
  });

  it('merchant: permission and owner-only policies apply; keys are per tenant', async () => {
    const owner = addMember('OWNER', []);
    const staff = addMember('STAFF', ['ITEMS_VIEW']);
    const manager = addMember('STAFF', ['ITEMS_MANAGE']);
    const post = (id: string, purpose: string): request.Test =>
      request(app)
        .post('/merchant/v1/uploads/presign')
        .set(bearer('MEMBER', id))
        .send({ purpose, ...JPEG });
    expect((await post(staff, 'ITEM_IMAGE')).status).toBe(403);
    expect((await post(manager, 'ITEM_IMAGE')).status).toBe(200);
    expect(bodyOf(await post(manager, 'PRIVATE_DOCUMENT')).error.code).toBe('OWNER_REQUIRED');
    const doc = await request(app)
      .post('/merchant/v1/uploads/presign')
      .set(bearer('MEMBER', owner))
      .send({ purpose: 'PRIVATE_DOCUMENT', contentType: 'application/pdf', size: 10 });
    expect(doc.status).toBe(200);
    expect(bodyOf(doc).data.key.startsWith(`documents/${tenantId.toHexString()}/`)).toBe(true);
    storage.simulateUpload(bodyOf(doc).data.key, { contentType: 'application/pdf', size: 10 });
    const confirmed = await request(app)
      .post('/merchant/v1/uploads/confirm')
      .set(bearer('MEMBER', owner))
      .send({ key: bodyOf(doc).data.key });
    expect(bodyOf(confirmed).data.url).toBeNull();
  });

  it('expired presigns cannot be confirmed; admins upload item images', async () => {
    const id = newId();
    const res = await request(app)
      .post('/admin/v1/uploads/presign')
      .set(bearer('ADMIN', id))
      .send({ purpose: 'ITEM_IMAGE', ...JPEG });
    expect(res.status).toBe(200);
    clock = new Date(clock.getTime() + (UPLOAD_URL_TTL_SEC + 1) * 1_000);
    storage.simulateUpload(bodyOf(res).data.key, { contentType: 'image/jpeg', size: 10 });
    const late = await request(app)
      .post('/admin/v1/uploads/confirm')
      .set(bearer('ADMIN', id))
      .send({ key: bodyOf(res).data.key });
    expect(bodyOf(late).error.code).toBe('UPLOAD_INVALID');
  });
});
