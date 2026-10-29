import { PERMISSIONS, type MemberRole, type Permission } from './enums';

/** Capabilities only the OWNER has; they are not permission keys and can never be granted. */
export const OWNER_ONLY_CAPABILITIES = ['TEAM_MANAGE'] as const;

/** What the owner is offered when adding a member. */
export const ROLE_TEMPLATES: Readonly<Record<Exclude<MemberRole, 'OWNER'>, readonly Permission[]>> =
  { STAFF: PERMISSIONS.filter((p) => p === 'ITEMS_VIEW') };

export const PERMISSION_MODES = ['any', 'all'] as const;
export type PermissionMode = (typeof PERMISSION_MODES)[number];
