import { Schema, model, type Types } from 'mongoose';
import { SUBJECT_TYPES, type SubjectType } from '../constants/enums';
import {
  REFRESH_TOKENS_COLLECTION,
  REVOKED_REASON_MAX_LENGTH,
  SUBJECT_ID_FAMILY_MAX_LENGTH,
  TOKEN_HASH_PATTERN,
} from '../constants/identity';
import { INSTALLATION_ID_PATTERN } from '../constants/providers';

/** A stored refresh token (BUSINESS_DOMAIN.md §3.1). The raw token is never stored, only its SHA-256. */
export interface RefreshTokenRaw {
  subjectType: SubjectType;
  subjectId: Types.ObjectId;
  installationId?: string;
  tokenHash: string;
  /** Rotation chain: reuse of a revoked token revokes the whole family. */
  familyId: string;
  replacedBy?: Types.ObjectId;
  expiresAt: Date;
  revokedAt?: Date;
  revokedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<RefreshTokenRaw>(
  {
    subjectType: { type: String, enum: SUBJECT_TYPES, required: true },
    subjectId: { type: Schema.Types.ObjectId, required: true },
    installationId: { type: String, match: INSTALLATION_ID_PATTERN },
    tokenHash: { type: String, required: true, match: TOKEN_HASH_PATTERN },
    familyId: { type: String, required: true, maxlength: SUBJECT_ID_FAMILY_MAX_LENGTH },
    replacedBy: { type: Schema.Types.ObjectId },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    revokedReason: { type: String, maxlength: REVOKED_REASON_MAX_LENGTH },
  },
  { timestamps: true, collection: REFRESH_TOKENS_COLLECTION },
);
refreshTokenSchema.index({ tokenHash: 1 }, { unique: true });
refreshTokenSchema.index({ subjectType: 1, subjectId: 1 });
// MongoDB deletes the document when `expiresAt` passes.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = model<RefreshTokenRaw>('RefreshToken', refreshTokenSchema);
