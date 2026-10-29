import { Schema, model } from 'mongoose';
import {
  ADMINS_COLLECTION,
  EMAIL_MAX_LENGTH,
  PASSWORD_HASH_MAX_LENGTH,
} from '../constants/identity';
import { EMAIL_PATTERN } from '../constants/providers';

/** The platform admin (BUSINESS_DOMAIN.md §3.1). */
export interface AdminRaw {
  email: string;
  /** bcrypt hash; the password itself is never stored. */
  passwordHash: string;
  failedLoginCount: number;
  lockedUntil?: Date;
  alertEmails: string[];
  lastLoginAt?: Date;
  lastLoginIp?: string;
  createdAt: Date;
  updatedAt: Date;
}

const adminSchema = new Schema<AdminRaw>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: EMAIL_MAX_LENGTH,
      match: EMAIL_PATTERN,
    },
    passwordHash: { type: String, required: true, maxlength: PASSWORD_HASH_MAX_LENGTH },
    failedLoginCount: { type: Number, default: 0, min: 0 },
    lockedUntil: { type: Date },
    alertEmails: {
      type: [{ type: String, lowercase: true, trim: true, match: EMAIL_PATTERN }],
      default: [],
    },
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },
  },
  { timestamps: true, collection: ADMINS_COLLECTION },
);
adminSchema.index({ email: 1 }, { unique: true });

export const AdminModel = model<AdminRaw>('Admin', adminSchema);
