import { Types, type Model } from 'mongoose';
import type { Permission, SubjectType } from '../constants/enums';
import { AdminModel, type AdminRaw } from '../models/admin.model';
import { CustomerModel, type CustomerRaw } from '../models/customer.model';
import { MemberModel, type MemberRaw } from '../models/member.model';
import { RefreshTokenModel, type RefreshTokenRaw } from '../models/refreshToken.model';
import { toEntity, type Entity } from '../utils/database/plain';
import { BaseRepository, isValidId } from './base.repository';

export class CustomersRepository extends BaseRepository<CustomerRaw> {
  constructor(model: Model<CustomerRaw> = CustomerModel) {
    super(model);
  }

  findByPhone(e164: string): Promise<Entity<CustomerRaw> | null> {
    return this.findOne({ phone: e164 });
  }

  /** `$set` and `$unset` in one update (profile edits, avatar removal); status is not touched here. */
  async patch(
    id: string,
    change: { set: Record<string, unknown>; unset?: readonly string[] },
  ): Promise<Entity<CustomerRaw> | null> {
    if (!isValidId(id)) return null;
    const unset = change.unset ?? [];
    const updated = await this.model
      .findOneAndUpdate(
        { _id: id },
        {
          $set: change.set,
          ...(unset.length === 0 ? {} : { $unset: Object.fromEntries(unset.map((f) => [f, 1])) }),
        },
        { returnDocument: 'after', runValidators: true },
      )
      .lean()
      .exec();
    return updated === null ? null : toEntity<CustomerRaw>(updated);
  }
}

export class MembersRepository extends BaseRepository<MemberRaw> {
  constructor(model: Model<MemberRaw> = MemberModel) {
    super(model);
  }

  findByPhone(e164: string): Promise<Entity<MemberRaw> | null> {
    return this.findOne({ phone: e164 });
  }

  /** The owner's `tenantId` is their own id, so the id is chosen before the insert. */
  async createOwner(
    data: Omit<Partial<MemberRaw>, 'tenantId' | 'role' | 'permissions'>,
  ): Promise<Entity<MemberRaw>> {
    const id = new Types.ObjectId();
    const created = await this.model.create({
      ...data,
      _id: id,
      tenantId: id,
      role: 'OWNER',
      permissions: [],
    } as never);
    return toEntity<MemberRaw>(created.toObject());
  }

  /** Logout: the device stops receiving pushes for this account. */
  async clearPushToken(id: string): Promise<void> {
    if (!isValidId(id)) return;
    await this.model.findOneAndUpdate({ _id: id }, { $unset: { pushToken: 1 } }).exec();
  }

  findTeam(tenantId: string): Promise<Entity<MemberRaw>[]> {
    return this.findMany({ tenantId }, { createdAt: 1 });
  }

  /** Permission grant / activation of a staff member of this tenant (owners are never changed here). */
  updateStaff(
    tenantId: string,
    id: string,
    patch: { permissions?: Permission[]; active?: boolean; name?: string },
  ): Promise<Entity<MemberRaw> | null> {
    if (!isValidId(id) || !isValidId(tenantId)) return Promise.resolve(null);
    const fields: Record<string, unknown> = {};
    if (patch.permissions !== undefined) fields['permissions'] = patch.permissions;
    if (patch.active !== undefined) fields['active'] = patch.active;
    if (patch.name !== undefined) fields['name'] = patch.name;
    return this.model
      .findOneAndUpdate(
        { _id: id, tenantId, role: 'STAFF' },
        { $set: fields },
        { returnDocument: 'after', runValidators: true },
      )
      .lean()
      .exec()
      .then((updated) => (updated === null ? null : toEntity<MemberRaw>(updated)));
  }
}

export class RefreshTokensRepository extends BaseRepository<RefreshTokenRaw> {
  constructor(model: Model<RefreshTokenRaw> = RefreshTokenModel) {
    super(model);
  }

  /** Looks a token up by the SHA-256 of the raw value; the raw token never reaches this layer. */
  findByTokenHash(tokenHash: string): Promise<Entity<RefreshTokenRaw> | null> {
    return this.findOne({ tokenHash });
  }

  /** Revokes the token only if it is still active; `null` means someone else got there first. */
  async revokeIfActive(
    id: string,
    reason: string,
    now: Date,
  ): Promise<Entity<RefreshTokenRaw> | null> {
    if (!isValidId(id)) return null;
    const updated = await this.model
      .findOneAndUpdate(
        { _id: id, revokedAt: { $exists: false } },
        { $set: { revokedAt: now, revokedReason: reason } },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();
    return updated === null ? null : toEntity<RefreshTokenRaw>(updated);
  }

  /** Links a rotated token to the one that replaced it. */
  async markReplaced(id: string, replacedBy: string): Promise<void> {
    await this.updateById(id, { replacedBy: new Types.ObjectId(replacedBy) });
  }

  /** Revokes every still-active token of one rotation chain; returns how many. */
  async revokeFamily(familyId: string, reason: string, now: Date): Promise<number> {
    return this.revokeActive({ familyId }, reason, now);
  }

  /** Revokes every still-active token of one account (logout everywhere, block, deactivation). */
  async revokeAllForSubject(
    subjectType: SubjectType,
    subjectId: string,
    reason: string,
    now: Date,
  ): Promise<number> {
    if (!isValidId(subjectId)) return 0;
    return this.revokeActive({ subjectType, subjectId }, reason, now);
  }

  private async revokeActive(
    filter: Record<string, unknown>,
    reason: string,
    now: Date,
  ): Promise<number> {
    const result = await this.model
      .updateMany({ ...filter, revokedAt: { $exists: false } } as never, {
        $set: { revokedAt: now, revokedReason: reason },
      })
      .exec();
    return result.modifiedCount;
  }
}

export class AdminsRepository extends BaseRepository<AdminRaw> {
  constructor(model: Model<AdminRaw> = AdminModel) {
    super(model);
  }

  findByEmail(email: string): Promise<Entity<AdminRaw> | null> {
    return this.findOne({ email: email.trim().toLowerCase() });
  }

  /**
   * Counts a wrong password (atomically) and, when it reaches `maxFailures`, locks the account
   * until `now + lockMs` and restarts the count. Returns the lock end, or `null` when not locked.
   */
  async recordFailedLogin(
    id: string,
    maxFailures: number,
    lockMs: number,
    now: Date,
  ): Promise<Date | null> {
    if (!isValidId(id)) return null;
    const counted = await this.model
      .findOneAndUpdate({ _id: id }, { $inc: { failedLoginCount: 1 } }, { returnDocument: 'after' })
      .lean()
      .exec();
    if (counted === null || counted.failedLoginCount < maxFailures) return null;
    const lockedUntil = new Date(now.getTime() + lockMs);
    await this.updateById(id, { lockedUntil, failedLoginCount: 0 });
    return lockedUntil;
  }

  /** A completed sign-in: clears the failure count and any lock, records when and from where. */
  async recordLogin(id: string, ip: string, now: Date): Promise<Entity<AdminRaw> | null> {
    if (!isValidId(id)) return null;
    const updated = await this.model
      .findOneAndUpdate(
        { _id: id },
        {
          $set: { failedLoginCount: 0, lastLoginAt: now, lastLoginIp: ip },
          $unset: { lockedUntil: 1 },
        },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();
    return updated === null ? null : toEntity<AdminRaw>(updated);
  }
}
