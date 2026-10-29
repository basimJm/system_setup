import { Schema, model, type Types } from 'mongoose';
import {
  UPLOADS_COLLECTION,
  UPLOAD_OWNER_TYPES,
  UPLOAD_PURPOSES,
  UPLOAD_STATUSES,
  type UploadOwnerType,
  type UploadPurpose,
  type UploadStatus,
} from '../constants/uploads';

/**
 * One file the server allowed a client to upload (docs/BUSINESS_DOMAIN.md §3.7). `tenantId` ties
 * merchant uploads to a merchant account so one account cannot use another's files.
 */
export interface UploadRaw {
  key: string;
  purpose: UploadPurpose;
  ownerType: UploadOwnerType;
  ownerId: string;
  tenantId?: Types.ObjectId;
  contentType: string;
  maxBytes: number;
  status: UploadStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const uploadSchema = new Schema<UploadRaw>(
  {
    key: { type: String, required: true },
    purpose: { type: String, enum: UPLOAD_PURPOSES, required: true },
    ownerType: { type: String, enum: UPLOAD_OWNER_TYPES, required: true },
    ownerId: { type: String, required: true },
    tenantId: { type: Schema.Types.ObjectId },
    contentType: { type: String, required: true },
    maxBytes: { type: Number, required: true, min: 1 },
    status: { type: String, enum: UPLOAD_STATUSES, default: 'PENDING' },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: UPLOADS_COLLECTION },
);
uploadSchema.index({ key: 1 }, { unique: true });
// Unconfirmed uploads disappear after their window; confirmed ones are kept.
uploadSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { status: 'PENDING' } },
);

export const UploadModel = model<UploadRaw>('Upload', uploadSchema);
