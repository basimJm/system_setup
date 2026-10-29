/**
 * Admin session rules (Admin PRD §4, BUSINESS_DOMAIN `admin.sessionIdleSec`, owner 2026-10-26: 2 days).
 * The server ends a session when its refresh token is not rotated for `admin.sessionIdleSec`; the client
 * idle sign-out uses the same length so it never ends a session earlier than the server would.
 */
export const SESSION_IDLE_DAYS = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const SESSION_IDLE_MS = SESSION_IDLE_DAYS * MS_PER_DAY;
/** The warning dialog opens this long before the idle timeout ends the session. */
export const IDLE_WARNING_MS = 60 * 1000;
/** An access token that expires within this time is refreshed (before the next request, or by the timer). */
export const REFRESH_SKEW_MS = 60 * 1000;
export const IDLE_TICK_MS = 1000;
/** Real user input that counts as activity (mouse movement alone does not). */
export const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
export const ACTIVITY_THROTTLE_MS = 1000;
export const MS_PER_SECOND = 1000;
/** Largest delay `setTimeout` accepts (2^31 - 1 ms); longer delays fire at once. */
export const MAX_TIMER_DELAY_MS = 2_147_483_647;
/** Web Locks name: one refresh at a time across every open tab (a reused refresh token revokes the family). */
export const SESSION_REFRESH_LOCK = 'admin.session.refresh';

/** Why a session ended without the admin pressing "Sign out". Shown on the login page. */
export const SESSION_END_REASONS = ['expired', 'idle'] as const;
export type SessionEndReason = (typeof SESSION_END_REASONS)[number];
