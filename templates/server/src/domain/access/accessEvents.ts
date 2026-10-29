/**
 * Real-time account events the domain triggers (docs/BUSINESS_DOMAIN.md §7): the sockets layer
 * implements it, so domain code never imports Socket.IO. All methods are best effort and never throw.
 */
export interface AccessEvents {
  /** A member's permissions changed: tell the app so it refreshes what it shows. */
  permissionsChanged(memberId: string): Promise<void>;
  /** The account lost access (blocked, deactivated): tell it and hang up. */
  accessRevoked(account: { scope: 'customer' | 'merchant'; id: string }): Promise<void>;
  /** The unread notification counter of an account changed. */
  unreadChanged(
    account: { scope: 'customer' | 'merchant'; id: string },
    count: number,
  ): Promise<void>;
}

export const noAccessEvents: AccessEvents = {
  permissionsChanged: () => Promise.resolve(),
  accessRevoked: () => Promise.resolve(),
  unreadChanged: () => Promise.resolve(),
};
