import { randomUUID } from 'node:crypto';
import type { MemberRole, Permission } from '../../constants/enums';
import { ERROR_CODES, errorMessageKey } from '../../constants/errorCodes';
import { MS_PER_SECOND } from '../../constants/time';
import {
  BYTES_PER_MB,
  UPLOAD_CONTENT_TYPES,
  UPLOAD_POLICIES,
  UPLOAD_URL_TTL_SEC,
  type UploadKind,
  type UploadOwnerType,
  type UploadPurpose,
  type UploadScope,
} from '../../constants/uploads';
import type { UploadRaw } from '../../models/upload.model';
import type { StorageProvider, UploadTarget } from '../../providers/storage';
import type { UploadsRepository } from '../../repositories/uploads.repository';
import { toObjectId } from '../../utils/database/ids';
import type { Entity } from '../../utils/database/plain';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  type ErrorDetail,
} from '../../utils/errors';
import { hasAllPermissions } from '../permissions/permissions';
import type { SettingsService } from '../settings';

/** Who asks for an upload and what they own. */
export interface UploadActor {
  readonly scope: UploadScope;
  readonly ownerType: UploadOwnerType;
  /** Customer id, member id or admin id. */
  readonly ownerId: string;
  /** Merchant members: their merchant account. */
  readonly tenantId?: string | undefined;
  readonly role?: MemberRole | undefined;
  readonly permissions?: readonly Permission[] | undefined;
}

export interface PresignedUpload {
  readonly key: string;
  readonly upload: UploadTarget;
  readonly maxBytes: number;
}

export interface UploadsService {
  presign(input: {
    purpose: UploadPurpose;
    contentType: string;
    size: number;
    actor: UploadActor;
  }): Promise<PresignedUpload>;
  /** After the client PUT the file: checks the real type and size, then marks the upload usable. */
  confirm(input: { key: string; actor: UploadActor }): Promise<{ key: string; url: string | null }>;
}

/** Lets other services accept only keys the server issued, confirmed, and for the right purpose. */
export interface UploadVerifier {
  assertConfirmed(input: {
    keys: readonly string[];
    purpose: UploadPurpose;
    field: string;
    /** Keys that are already in use and stay valid without a new check. */
    allow?: readonly string[];
    accept?: (upload: Entity<UploadRaw>) => boolean;
  }): Promise<void>;
}

export interface UploadsDeps {
  readonly uploads: UploadsRepository;
  readonly storage: Pick<StorageProvider, 'createUploadUrl' | 'confirmUpload' | 'getPublicUrl'>;
  readonly settings: Pick<SettingsService, 'get'>;
  readonly now?: () => Date;
  readonly newId?: () => string;
  /** Called once when a public image becomes CONFIRMED (e.g. to make size variants). */
  readonly afterConfirm?: (upload: { key: string; purpose: UploadPurpose }) => void;
}

const reject = (
  code: typeof ERROR_CODES.UPLOAD_INVALID | typeof ERROR_CODES.UPLOAD_TOO_LARGE,
  field: string,
): ValidationError =>
  new ValidationError({
    code,
    details: [{ field, code, messageKey: errorMessageKey(code) }],
  });

export const createUploadsService = (deps: UploadsDeps): UploadsService & UploadVerifier => {
  const { uploads, storage, settings } = deps;
  const now = deps.now ?? ((): Date => new Date());
  const newId = deps.newId ?? randomUUID;

  const maxBytesFor = async (kind: UploadKind): Promise<number> => {
    const key = kind === 'document' ? 'uploads.docMaxMb' : 'uploads.imageMaxMb';
    return (await settings.get(key)) * BYTES_PER_MB;
  };

  const sameOwner = (record: Entity<UploadRaw>, actor: UploadActor): boolean =>
    record.ownerType === actor.ownerType &&
    record.ownerId === actor.ownerId &&
    (actor.tenantId === undefined || record.tenantId === actor.tenantId);

  return {
    async presign({ purpose, contentType, size, actor }) {
      const policy = UPLOAD_POLICIES[purpose];
      if (!policy.scopes.includes(actor.scope))
        throw new ForbiddenError({ code: ERROR_CODES.PERMISSION_DENIED });
      if (actor.scope === 'merchant') {
        if (policy.ownerOnly === true && actor.role !== 'OWNER') {
          throw new ForbiddenError({ code: ERROR_CODES.OWNER_REQUIRED });
        }
        if (
          policy.permission !== undefined &&
          !hasAllPermissions(
            { role: actor.role ?? 'STAFF', permissions: actor.permissions ?? [] },
            [policy.permission],
          )
        ) {
          throw new ForbiddenError({ code: ERROR_CODES.PERMISSION_DENIED });
        }
      }
      const extension = UPLOAD_CONTENT_TYPES[policy.kind][contentType];
      if (extension === undefined) throw reject(ERROR_CODES.UPLOAD_INVALID, 'body.contentType');
      const limit = await maxBytesFor(policy.kind);
      if (!Number.isSafeInteger(size) || size < 1)
        throw reject(ERROR_CODES.UPLOAD_INVALID, 'body.size');
      if (size > limit) throw reject(ERROR_CODES.UPLOAD_TOO_LARGE, 'body.size');

      const key = `${policy.prefix}/${actor.tenantId ?? actor.ownerId}/${newId()}.${extension}`;
      const expiresAt = new Date(now().getTime() + UPLOAD_URL_TTL_SEC * MS_PER_SECOND);
      await uploads.create({
        key,
        purpose,
        ownerType: actor.ownerType,
        ownerId: actor.ownerId,
        ...(actor.tenantId === undefined ? {} : { tenantId: toObjectId(actor.tenantId) }),
        contentType,
        maxBytes: size,
        status: 'PENDING',
        expiresAt,
      });
      const target = await storage.createUploadUrl({
        key,
        visibility: policy.visibility,
        contentType,
        maxBytes: size,
        expiresInSec: UPLOAD_URL_TTL_SEC,
      });
      return { key, upload: target, maxBytes: size };
    },

    async confirm({ key, actor }) {
      const record = await uploads.findByKey(key);
      if (record === null || !sameOwner(record, actor)) {
        throw new NotFoundError({ code: ERROR_CODES.NOT_FOUND });
      }
      const policy = UPLOAD_POLICIES[record.purpose];
      const url = policy.visibility === 'PUBLIC' ? storage.getPublicUrl(key) : null;
      if (record.status === 'CONFIRMED') return { key, url };
      if (record.status === 'REJECTED' || record.expiresAt.getTime() <= now().getTime()) {
        throw reject(ERROR_CODES.UPLOAD_INVALID, 'body.key');
      }
      const result = await storage.confirmUpload({
        key,
        visibility: policy.visibility,
        contentType: record.contentType,
        maxBytes: record.maxBytes,
      });
      if (result.status === 'REJECTED') {
        // A file that is not there yet may still arrive; a wrong file was already deleted.
        if (result.reason !== 'NOT_FOUND') await uploads.transition(key, 'PENDING', 'REJECTED');
        throw reject(
          result.reason === 'TOO_LARGE' ? ERROR_CODES.UPLOAD_TOO_LARGE : ERROR_CODES.UPLOAD_INVALID,
          'body.key',
        );
      }
      const claimed = await uploads.transition(key, 'PENDING', 'CONFIRMED');
      if (claimed !== null && policy.visibility === 'PUBLIC' && policy.kind === 'image') {
        deps.afterConfirm?.({ key, purpose: record.purpose });
      }
      return { key, url };
    },

    async assertConfirmed({ keys, purpose, field, allow = [], accept = () => true }) {
      const toCheck = keys.filter((key) => !allow.includes(key));
      if (toCheck.length === 0) return;
      const found = new Map((await uploads.findByKeys(toCheck)).map((u) => [u.key, u]));
      const details: ErrorDetail[] = [];
      toCheck.forEach((key) => {
        const upload = found.get(key);
        if (upload?.status !== 'CONFIRMED' || upload.purpose !== purpose || !accept(upload)) {
          details.push({
            field,
            code: ERROR_CODES.UPLOAD_INVALID,
            messageKey: errorMessageKey(ERROR_CODES.UPLOAD_INVALID),
          });
        }
      });
      if (details.length > 0)
        throw new ValidationError({ code: ERROR_CODES.UPLOAD_INVALID, details });
    },
  };
};
