import { SESSION_IDLE_MS } from './session';

export const OTP_LENGTH = 6;
/** Defaults until the admin settings API supplies them (Admin PRD §4, A28). */
export const OTP_VALID_MINUTES = 10;
export const RESEND_SECONDS = 60;
export const MASK_CHAR = '•';
export const MIN_PASSWORD_LENGTH = 8;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mock data source only (dev builds): the code that completes any mock login. */
export const MOCK_OTP_CODE = '123456';
export const MOCK_LATENCY_MS = 400;
export const MOCK_OTP_TTL_MS = 10 * 60 * 1000;
export const MOCK_ADMIN = { id: 'admin-1', name: 'Demo Admin' } as const;
export const MOCK_TOKEN = 'mock-access-token';

/** Mock session lifetimes (dev builds): short access token so the refresh path is exercised. */
export const MOCK_ACCESS_TTL_MS = 15 * 60 * 1000;
export const MOCK_REFRESH_TTL_MS = SESSION_IDLE_MS;
export const MOCK_REFRESH_PREFIX = 'mock-refresh-';
export const MOCK_REFRESH_SEPARATOR = ':';

/** Admin profile limits (the server contract: `POST /profile/password`, `PATCH /profile`). */
export const MIN_NEW_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 256;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_ALERT_EMAILS = 10;
export const EMAIL_CODE_PATTERN = /^[0-9]{4,10}$/;
export const MOCK_EMAIL_CODE = '123456';
