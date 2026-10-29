import type { RequestHandler } from 'express';
import type { Permission } from '../constants/enums';
import { ERROR_CODES } from '../constants/errorCodes';
import type { PermissionMode } from '../constants/permissions';
import {
  effectivePermissions,
  hasAllPermissions,
  hasAnyPermission,
} from '../domain/permissions/permissions';
import type { MembersRepository } from '../repositories/identity.repository';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

/**
 * Loads the signed-in member from the database on every request, so an owner's change of role or
 * permissions (or a deactivation) applies at once: the JWT only names the member.
 * Sets `req.member`. Run it after `requireAuth('merchant', ...)`.
 */
export const loadMember =
  (members: Pick<MembersRepository, 'findById'>): RequestHandler =>
  (req, _res, next) => {
    const subjectId = req.auth?.subjectId;
    if (subjectId === undefined) {
      next(new UnauthorizedError());
      return;
    }
    members.findById(subjectId).then((member) => {
      if (member === null) {
        next(new UnauthorizedError());
        return;
      }
      if (!member.active) {
        next(new ForbiddenError({ code: ERROR_CODES.MEMBER_INACTIVE }));
        return;
      }
      req.member = {
        id: member.id,
        tenantId: member.tenantId,
        role: member.role,
        permissions: effectivePermissions(member),
      };
      next();
    }, next);
  };

/** Needs `loadMember` first. `all` (default) wants every key, `any` at least one. */
export const requirePermission =
  (permissions: readonly Permission[], mode: PermissionMode = 'all'): RequestHandler =>
  (req, _res, next) => {
    const member = req.member;
    if (member === undefined) {
      next(new UnauthorizedError());
      return;
    }
    const allowed =
      mode === 'all'
        ? hasAllPermissions(member, permissions)
        : hasAnyPermission(member, permissions);
    next(allowed ? undefined : new ForbiddenError({ code: ERROR_CODES.PERMISSION_DENIED }));
  };

/** Team management belongs to the OWNER only. */
export const requireOwner: RequestHandler = (req, _res, next) => {
  if (req.member === undefined) {
    next(new UnauthorizedError());
    return;
  }
  next(
    req.member.role === 'OWNER'
      ? undefined
      : new ForbiddenError({ code: ERROR_CODES.OWNER_REQUIRED }),
  );
};
