import { PERMISSIONS } from '../src/constants/enums';
import {
  defaultPermissionsFor,
  effectivePermissions,
  hasAllPermissions,
  hasAnyPermission,
  normalizeGrant,
} from '../src/domain/permissions/permissions';
import { ValidationError } from '../src/utils/errors';

describe('permissions', () => {
  it('the owner has everything; staff have exactly their grant', () => {
    expect(effectivePermissions({ role: 'OWNER', permissions: [] })).toEqual(PERMISSIONS);
    expect(effectivePermissions({ role: 'STAFF', permissions: ['ITEMS_VIEW'] })).toEqual([
      'ITEMS_VIEW',
    ]);
    expect(
      hasAllPermissions({ role: 'STAFF', permissions: ['ITEMS_VIEW'] }, [
        'ITEMS_VIEW',
        'ITEMS_MANAGE',
      ]),
    ).toBe(false);
    expect(
      hasAnyPermission({ role: 'STAFF', permissions: ['ITEMS_VIEW'] }, [
        'ITEMS_VIEW',
        'ITEMS_MANAGE',
      ]),
    ).toBe(true);
    expect(defaultPermissionsFor('STAFF')).toEqual(['ITEMS_VIEW']);
    expect(defaultPermissionsFor('OWNER')).toEqual([]);
  });

  it('normalizes grants: canonical order, no duplicates, unknown and owner-only keys refused with details', () => {
    expect(normalizeGrant(['ITEMS_MANAGE', 'ITEMS_VIEW', 'ITEMS_VIEW'])).toEqual([
      'ITEMS_VIEW',
      'ITEMS_MANAGE',
    ]);
    expect(() => normalizeGrant(['NOPE'])).toThrow(ValidationError);
    try {
      normalizeGrant(['TEAM_MANAGE', 'NOPE']);
    } catch (error) {
      expect((error as ValidationError).details.map((d) => d.code)).toEqual([
        'OWNER_REQUIRED',
        'VALIDATION_ERROR',
      ]);
    }
  });
});
