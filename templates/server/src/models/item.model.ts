import { Schema, model, type Types } from 'mongoose';
import {
  ITEM_OWNER_TYPES,
  ITEM_STATUSES,
  type ItemOwnerType,
  type ItemStatus,
} from '../constants/enums';
import {
  ITEMS_COLLECTION,
  ITEM_DESCRIPTION_MAX_LENGTH,
  ITEM_MAX_TAGS,
  ITEM_TAG_MAX_LENGTH,
  ITEM_TITLE_MAX_LENGTH,
  ITEM_TITLE_MIN_LENGTH,
} from '../constants/items';
import { AUDIT_REASON_MAX_LENGTH } from '../constants/audit';

/**
 * Sample feature (docs/BUSINESS_DOMAIN.md §3.8): a record owned by a customer or by a merchant
 * account (`ownerId` = the tenant id, shared by every member). Replace it with the real domain.
 */
export interface ItemRaw {
  ownerType: ItemOwnerType;
  ownerId: Types.ObjectId;
  title: string;
  description?: string;
  tags: string[];
  imageKey?: string;
  status: ItemStatus;
  /** Set when an admin archived it (the owner is told why). */
  archivedReason?: string;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<ItemRaw>(
  {
    ownerType: { type: String, enum: ITEM_OWNER_TYPES, required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: ITEM_TITLE_MIN_LENGTH,
      maxlength: ITEM_TITLE_MAX_LENGTH,
    },
    description: { type: String, trim: true, maxlength: ITEM_DESCRIPTION_MAX_LENGTH },
    tags: {
      type: [{ type: String, trim: true, maxlength: ITEM_TAG_MAX_LENGTH }],
      default: [],
      validate: (tags: string[]): boolean => tags.length <= ITEM_MAX_TAGS,
    },
    imageKey: { type: String },
    status: { type: String, enum: ITEM_STATUSES, default: 'ACTIVE' },
    archivedReason: { type: String, maxlength: AUDIT_REASON_MAX_LENGTH },
    archivedAt: { type: Date },
  },
  { timestamps: true, collection: ITEMS_COLLECTION },
);
// An owner's list (newest first) and the admin list by status.
itemSchema.index({ ownerType: 1, ownerId: 1, status: 1, createdAt: -1 });
itemSchema.index({ status: 1, createdAt: -1 });
itemSchema.index({ tags: 1 });

export const ItemModel = model<ItemRaw>('Item', itemSchema);
