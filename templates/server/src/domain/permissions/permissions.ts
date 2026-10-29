import { PERMISSIONS, type MemberRole, type Permission } from '../../constants/enums';
import { OWNER_ONLY_CAPABILITIES, ROLE_TEMPLATES } from '../../constants/permissions';
import { ValidationError, type ErrorDetail } from '../../utils/errors';
import { ERROR_CODES, errorMessageKey } from '../../constants/errorCodes';

const known = new Set<string>(PERMISSIONS);

/** The owner always has every permission; others get what they were granted. */
export const effectivePermissions = (member: {
  role: MemberRole;
  permissions: readonly Permission[];
}): readonly Permission[] => (member.role === 'OWNER' ? PERMISSIONS : member.permissions);

export const hasAllPermissions = (
  member: { role: MemberRole; permissions: readonly Permission[] },
  required: readonly Permission[],
): boolean => {
  const have = new Set<Permission>(effectivePermissions(member));
  return required.every((p) => have.has(p));
};

export const hasAnyPermission = (
  member: { role: MemberRole; permissions: readonly Permission[] },
  required: readonly Permission[],
): boolean => {
  const have = new Set<Permission>(effectivePermissions(member));
  return required.some((p) => have.has(p));
};

/** Starting permissions for a new member of this role (the owner needs none stored). */
export const defaultPermissionsFor = (role: MemberRole): Permission[] =>
  role === 'OWNER' ? [] : [...ROLE_TEMPLATES[role]];

/**
 * Validates a grant the owner sends for a staff member: only known permission keys, no
 * owner-only capability, no duplicates (returned de-duplicated, in the canonical order).
 */
export const normalizeGrant = (
  requested: readonly string[],
  field = 'body.permissions',
): Permission[] => {
  const ownerOnly = new Set<string>(OWNER_ONLY_CAPABILITIES);
  const details: ErrorDetail[] = requested
    .filter((key) => !known.has(key))
    .map((key) => ({
      field,
      code: ownerOnly.has(key) ? ERROR_CODES.OWNER_REQUIRED : ERROR_CODES.VALIDATION_ERROR,
      messageKey: errorMessageKey(
        ownerOnly.has(key) ? ERROR_CODES.OWNER_REQUIRED : ERROR_CODES.VALIDATION_ERROR,
      ),
    }));
  if (details.length > 0) throw new ValidationError({ details });
  const wanted = new Set(requested);
  return PERMISSIONS.filter((p) => wanted.has(p));
};
