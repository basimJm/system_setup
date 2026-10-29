import type { Permission } from './enums';
import type { StorageVisibility } from './providers';

/** Uploads module (docs/BUSINESS_DOMAIN.md §3.7 `uploads`): presign → direct upload → confirm. */
export const UPLOADS_COLLECTION = 'uploads';
export const UPLOAD_STATUSES = ['PENDING', 'CONFIRMED', 'REJECTED'] as const;
export type UploadStatus = (typeof UPLOAD_STATUSES)[number];
export const UPLOAD_OWNER_TYPES = ['CUSTOMER', 'MEMBER', 'ADMIN'] as const;
export type UploadOwnerType = (typeof UPLOAD_OWNER_TYPES)[number];

export const UPLOAD_PURPOSES = [
  'CUSTOMER_AVATAR',
  'MEMBER_PHOTO',
  'ITEM_IMAGE',
  'PRIVATE_DOCUMENT',
] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

export type UploadKind = 'image' | 'document';
export const UPLOAD_CONTENT_TYPES: Readonly<Record<UploadKind, Readonly<Record<string, string>>>> =
  {
    image: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' },
    document: {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    },
  };

export type UploadScope = 'customer' | 'merchant' | 'admin';

export interface UploadPolicy {
  readonly kind: UploadKind;
  readonly visibility: StorageVisibility;
  /** First part of the generated key. */
  readonly prefix: string;
  /** Who may ask for an upload URL for this purpose. */
  readonly scopes: readonly UploadScope[];
  /** Merchant permission the member needs (the owner always has it). */
  readonly permission?: Permission;
  /** Merchant members only: owners only. */
  readonly ownerOnly?: boolean;
}

export const UPLOAD_POLICIES: Readonly<Record<UploadPurpose, UploadPolicy>> = {
  CUSTOMER_AVATAR: {
    kind: 'image',
    visibility: 'PUBLIC',
    prefix: 'customers',
    scopes: ['customer'],
  },
  MEMBER_PHOTO: { kind: 'image', visibility: 'PUBLIC', prefix: 'members', scopes: ['merchant'] },
  ITEM_IMAGE: {
    kind: 'image',
    visibility: 'PUBLIC',
    prefix: 'items',
    scopes: ['customer', 'merchant', 'admin'],
    permission: 'ITEMS_MANAGE',
  },
  PRIVATE_DOCUMENT: {
    kind: 'document',
    visibility: 'PRIVATE',
    prefix: 'documents',
    scopes: ['merchant'],
    ownerOnly: true,
  },
};

export const BYTES_PER_MB = 1_048_576;
/** Lifetime of a presigned upload URL and of the pending record. */
export const UPLOAD_URL_TTL_SEC = 300;
/** Per-IP budget of presign/confirm; its own counter. */
export const UPLOAD_ROUTE_RATE_LIMIT = { windowMs: 60_000, max: 20 } as const;
export const UPLOAD_ROUTES = {
  base: '/uploads',
  presign: '/presign',
  confirm: '/confirm',
} as const;
export const UPLOAD_CONTENT_TYPE_MAX_LENGTH = 100;
