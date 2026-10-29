import type { ItemOwnerType, ItemStatus } from '../../constants/enums';
import { ERROR_CODES } from '../../constants/errorCodes';
import { ITEM_AUDIT } from '../../constants/items';
import type { ItemRaw } from '../../models/item.model';
import type { ItemFilter, ItemsRepository } from '../../repositories/items.repository';
import { toObjectId } from '../../utils/database/ids';
import type { Entity } from '../../utils/database/plain';
import { BusinessRuleError, NotFoundError } from '../../utils/errors';
import type { PaginationMeta, PaginationParams } from '../../utils/pagination';
import type { AuditWriter } from '../audit';
import type { NotificationService } from '../notifications/notifications.service';
import type { SettingsService } from '../settings';
import type { UploadVerifier } from '../uploads/uploads.service';

/** The item as every namespace returns it (the admin adds owner and archive fields). */
export interface ItemView {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly tags: readonly string[];
  readonly imageUrl: string | null;
  readonly status: ItemStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AdminItemView extends ItemView {
  readonly owner: { readonly type: ItemOwnerType; readonly id: string };
  readonly archivedReason?: string;
  readonly archivedAt?: Date;
}

export interface ItemOwner {
  readonly type: ItemOwnerType;
  readonly id: string;
}

export interface ItemInput {
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly tags?: readonly string[] | undefined;
  /** A confirmed `ITEM_IMAGE` upload key of the same owner. */
  readonly imageKey?: string | null | undefined;
}

/** What the admin write carries besides the change: who, why, from where (audit log). */
export interface AdminContext {
  readonly adminId: string;
  readonly reason: string;
  readonly ip: string;
  readonly userAgent: string;
}

export interface ItemsService {
  list(
    owner: ItemOwner,
    filter: Pick<ItemFilter, 'status' | 'tag' | 'q'>,
    params: PaginationParams,
  ): Promise<{ items: ItemView[]; meta: PaginationMeta }>;
  get(owner: ItemOwner, id: string): Promise<ItemView>;
  create(owner: ItemOwner, input: ItemInput & { readonly title: string }): Promise<ItemView>;
  update(owner: ItemOwner, id: string, input: ItemInput): Promise<ItemView>;
  /** Owners archive their own items (soft delete); nothing is ever hard-deleted. */
  archive(owner: ItemOwner, id: string): Promise<ItemView>;
  adminList(
    filter: ItemFilter,
    params: PaginationParams,
  ): Promise<{ items: AdminItemView[]; meta: PaginationMeta }>;
  adminGet(id: string): Promise<AdminItemView>;
  /** Admin archive: reason required, audit entry, owner notified (CLAUDE.md §5.12). */
  adminArchive(id: string, context: AdminContext): Promise<AdminItemView>;
  adminRestore(id: string, context: AdminContext): Promise<AdminItemView>;
}

export interface ItemsDeps {
  readonly items: ItemsRepository;
  readonly settings: Pick<SettingsService, 'get'>;
  readonly uploads: Pick<UploadVerifier, 'assertConfirmed'>;
  readonly publicUrl: (key: string) => string;
  readonly audit: Pick<AuditWriter, 'record'>;
  readonly notifications: Pick<NotificationService, 'notify'>;
  /** Real-time hooks (socket layer); optional so unit tests and seeds need none. */
  readonly events?: {
    created?: (item: AdminItemView) => void;
    updated?: (item: AdminItemView) => void;
  };
  readonly now?: () => Date;
}

const notFound = (): NotFoundError => new NotFoundError({ code: ERROR_CODES.ITEM_NOT_FOUND });

export const createItemsService = (deps: ItemsDeps): ItemsService => {
  const { items, settings, uploads, publicUrl, audit, notifications } = deps;
  const now = deps.now ?? ((): Date => new Date());

  const toView = (item: Entity<ItemRaw>): ItemView => ({
    id: item.id,
    title: item.title,
    ...(item.description === undefined ? {} : { description: item.description }),
    tags: item.tags,
    imageUrl: item.imageKey === undefined ? null : publicUrl(item.imageKey),
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  });
  const toAdminView = (item: Entity<ItemRaw>): AdminItemView => ({
    ...toView(item),
    owner: { type: item.ownerType, id: item.ownerId },
    ...(item.archivedReason === undefined ? {} : { archivedReason: item.archivedReason }),
    ...(item.archivedAt === undefined ? {} : { archivedAt: item.archivedAt }),
  });

  const owned = async (owner: ItemOwner, id: string): Promise<Entity<ItemRaw>> => {
    const item = await items.findById(id);
    if (item === null || item.ownerType !== owner.type || item.ownerId !== owner.id)
      throw notFound();
    return item;
  };

  const checkImage = async (owner: ItemOwner, imageKey: string, allow: string[]): Promise<void> => {
    await uploads.assertConfirmed({
      keys: [imageKey],
      purpose: 'ITEM_IMAGE',
      field: 'body.imageKey',
      allow,
      // An upload of one owner can never end up on another owner's item.
      accept: (upload) => upload.ownerId === owner.id || upload.tenantId === owner.id,
    });
  };

  const recipientOf = (item: Entity<ItemRaw>): { type: 'CUSTOMER' | 'MEMBER'; id: string } =>
    // A merchant item belongs to the tenant, whose owner member has the tenant id as its own id.
    item.ownerType === 'CUSTOMER'
      ? { type: 'CUSTOMER', id: item.ownerId }
      : { type: 'MEMBER', id: item.ownerId };

  return {
    async list(owner, filter, params) {
      const page = await items.findPageBy(
        { ownerType: owner.type, ownerId: owner.id, ...filter },
        params,
      );
      return { items: page.items.map(toView), meta: page.meta };
    },

    async get(owner, id) {
      return toView(await owned(owner, id));
    },

    async create(owner, input) {
      const limit = await settings.get('items.maxPerOwner');
      if ((await items.countActive(owner.type, owner.id)) >= limit)
        throw new BusinessRuleError({ code: ERROR_CODES.ITEM_LIMIT_REACHED });
      if (input.imageKey != null) await checkImage(owner, input.imageKey, []);
      const created = await items.create({
        ownerType: owner.type,
        ownerId: toObjectId(owner.id),
        title: input.title,
        ...(input.description === undefined ? {} : { description: input.description }),
        tags: [...(input.tags ?? [])],
        ...(input.imageKey == null ? {} : { imageKey: input.imageKey }),
        status: 'ACTIVE',
      });
      deps.events?.created?.(toAdminView(created));
      return toView(created);
    },

    async update(owner, id, input) {
      const item = await owned(owner, id);
      if (item.status === 'ARCHIVED')
        throw new BusinessRuleError({ code: ERROR_CODES.ITEM_ARCHIVED });
      if (input.imageKey != null && input.imageKey !== item.imageKey)
        await checkImage(owner, input.imageKey, []);
      const updated = await items.updateById(id, {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.tags === undefined ? {} : { tags: [...input.tags] }),
        ...(input.imageKey === undefined ? {} : { imageKey: input.imageKey ?? undefined }),
      });
      if (updated === null) throw notFound();
      deps.events?.updated?.(toAdminView(updated));
      return toView(updated);
    },

    async archive(owner, id) {
      await owned(owner, id);
      const updated = await items.updateById(id, { status: 'ARCHIVED', archivedAt: now() });
      if (updated === null) throw notFound();
      deps.events?.updated?.(toAdminView(updated));
      return toView(updated);
    },

    async adminList(filter, params) {
      const page = await items.findPageBy(filter, params);
      return { items: page.items.map(toAdminView), meta: page.meta };
    },

    async adminGet(id) {
      const item = await items.findById(id);
      if (item === null) throw notFound();
      return toAdminView(item);
    },

    async adminArchive(id, context) {
      const item = await items.findById(id);
      if (item === null) throw notFound();
      if (item.status === 'ARCHIVED')
        throw new BusinessRuleError({ code: ERROR_CODES.ITEM_ARCHIVED });
      const updated = await items.updateById(id, {
        status: 'ARCHIVED',
        archivedReason: context.reason,
        archivedAt: now(),
      });
      if (updated === null) throw notFound();
      await audit.record({
        adminId: context.adminId,
        action: ITEM_AUDIT.actions.archive,
        entityType: ITEM_AUDIT.entityType,
        entityId: id,
        before: { status: item.status },
        after: { status: updated.status },
        reason: context.reason,
        ip: context.ip,
        userAgent: context.userAgent,
      });
      await notifications.notify({
        recipient: recipientOf(updated),
        event: 'item.archived_by_admin',
        params: { title: updated.title, reason: context.reason },
        data: { itemId: updated.id },
        dedupeKey: `item.archived_by_admin:${updated.id}:${String(updated.archivedAt?.getTime() ?? 0)}`,
      });
      deps.events?.updated?.(toAdminView(updated));
      return toAdminView(updated);
    },

    async adminRestore(id, context) {
      const item = await items.findById(id);
      if (item === null) throw notFound();
      if (item.status === 'ACTIVE')
        throw new BusinessRuleError({ code: ERROR_CODES.ITEM_ARCHIVED });
      const updated = await items.updateById(id, { status: 'ACTIVE' });
      if (updated === null) throw notFound();
      await audit.record({
        adminId: context.adminId,
        action: ITEM_AUDIT.actions.restore,
        entityType: ITEM_AUDIT.entityType,
        entityId: id,
        before: { status: item.status },
        after: { status: updated.status },
        reason: context.reason,
        ip: context.ip,
        userAgent: context.userAgent,
      });
      await notifications.notify({
        recipient: recipientOf(updated),
        event: 'item.restored_by_admin',
        params: { title: updated.title },
        data: { itemId: updated.id },
        dedupeKey: `item.restored_by_admin:${updated.id}:${String(now().getTime())}`,
      });
      deps.events?.updated?.(toAdminView(updated));
      return toAdminView(updated);
    },
  };
};
