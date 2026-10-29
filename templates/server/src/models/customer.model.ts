import { Schema, model } from 'mongoose';
import {
  BLOCKED_REASON_MAX_LENGTH,
  CUSTOMERS_COLLECTION,
  EMAIL_MAX_LENGTH,
  PERSON_NAME_MAX_LENGTH,
  PERSON_NAME_MIN_LENGTH,
  PUSH_TOKEN_MAX_LENGTH,
} from '../constants/identity';
import {
  CUSTOMER_STATUSES,
  LANGUAGES,
  type CustomerStatus,
  type Language,
} from '../constants/enums';
import { EMAIL_PATTERN, E164_PATTERN } from '../constants/providers';

/** A customer account, signed in by phone OTP (docs/BUSINESS_DOMAIN.md §3.1). */
export interface CustomerRaw {
  name: string;
  /** E.164, unique. */
  phone: string;
  email?: string;
  avatarKey?: string;
  language: Language;
  /** Device push token of the last sign-in; absent = no push. */
  pushToken?: string;
  status: CustomerStatus;
  blockedReason?: string;
  blockedAt?: Date;
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<CustomerRaw>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: PERSON_NAME_MIN_LENGTH,
      maxlength: PERSON_NAME_MAX_LENGTH,
    },
    phone: { type: String, required: true, match: E164_PATTERN },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      maxlength: EMAIL_MAX_LENGTH,
      match: EMAIL_PATTERN,
    },
    avatarKey: { type: String },
    language: { type: String, enum: LANGUAGES, default: 'ar' },
    pushToken: { type: String, maxlength: PUSH_TOKEN_MAX_LENGTH },
    status: { type: String, enum: CUSTOMER_STATUSES, default: 'ACTIVE' },
    blockedReason: { type: String, maxlength: BLOCKED_REASON_MAX_LENGTH },
    blockedAt: { type: Date },
    lastActiveAt: { type: Date },
  },
  { timestamps: true, collection: CUSTOMERS_COLLECTION },
);
// One customer per phone; admin lists filter by status and sort by creation.
customerSchema.index({ phone: 1 }, { unique: true });
customerSchema.index({ status: 1, createdAt: -1 });

export const CustomerModel = model<CustomerRaw>('Customer', customerSchema);
