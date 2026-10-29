import { Schema, model, type Types } from 'mongoose';
import {
  LANGUAGES,
  MEMBER_ROLES,
  PERMISSIONS,
  type Language,
  type MemberRole,
  type Permission,
} from '../constants/enums';
import {
  MEMBERS_COLLECTION,
  PERSON_NAME_MAX_LENGTH,
  PERSON_NAME_MIN_LENGTH,
  PUSH_TOKEN_MAX_LENGTH,
} from '../constants/identity';
import { BUSINESS_NAME_MAX_LENGTH, BUSINESS_NAME_MIN_LENGTH } from '../constants/merchantAuth';
import { E164_PATTERN } from '../constants/providers';

/**
 * A merchant account member (docs/BUSINESS_DOMAIN.md §3.4). The OWNER opened the account: their
 * `tenantId` is their own id. STAFF members share the owner's `tenantId` and carry a permission grant.
 */
export interface MemberRaw {
  tenantId: Types.ObjectId;
  /** The merchant's trading name; stored on every member for cheap reads. */
  businessName: string;
  name: string;
  /** E.164, unique across merchants. */
  phone: string;
  photoKey?: string;
  role: MemberRole;
  /** Ignored for the OWNER, who has all permissions. */
  permissions: Permission[];
  active: boolean;
  language: Language;
  pushToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

const memberSchema = new Schema<MemberRaw>(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true },
    businessName: {
      type: String,
      required: true,
      trim: true,
      minlength: BUSINESS_NAME_MIN_LENGTH,
      maxlength: BUSINESS_NAME_MAX_LENGTH,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: PERSON_NAME_MIN_LENGTH,
      maxlength: PERSON_NAME_MAX_LENGTH,
    },
    phone: { type: String, required: true, match: E164_PATTERN },
    photoKey: { type: String },
    role: { type: String, enum: MEMBER_ROLES, required: true },
    permissions: { type: [{ type: String, enum: PERMISSIONS }], default: [] },
    active: { type: Boolean, default: true },
    language: { type: String, enum: LANGUAGES, default: 'ar' },
    pushToken: { type: String, maxlength: PUSH_TOKEN_MAX_LENGTH },
  },
  { timestamps: true, collection: MEMBERS_COLLECTION },
);
memberSchema.index({ phone: 1 }, { unique: true });
memberSchema.index({ tenantId: 1, active: 1 });
// Exactly one OWNER per merchant account, enforced by the database.
memberSchema.index({ tenantId: 1 }, { unique: true, partialFilterExpression: { role: 'OWNER' } });

export const MemberModel = model<MemberRaw>('Member', memberSchema);
