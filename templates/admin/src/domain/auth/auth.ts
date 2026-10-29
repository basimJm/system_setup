export interface AdminProfile {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

/** Step 1 answer: the emailed code is required until `expiresAt`; a new one can be asked after `resendAfterSeconds`. */
export interface LoginChallenge {
  readonly otpRequired: boolean;
  /** Epoch ms when the emailed code stops working. */
  readonly expiresAt: number;
  readonly resendAfterSeconds: number;
}

export interface Session {
  readonly accessToken: string;
  readonly admin: AdminProfile;
  /** Epoch ms when the access token stops working; missing = unknown (the lifecycle then relies on 401). */
  readonly accessExpiresAt?: number;
  /** Rotates on every refresh and is revoked on logout. In memory + this tab's sessionStorage (never localStorage). */
  readonly refreshToken?: string;
  readonly refreshExpiresAt?: number;
}

/** Domain contract. Remote and mock implementations live in `data/`; the UI only sees this. */
export interface AuthRepository {
  login(email: string, password: string): Promise<LoginChallenge>;
  verifyOtp(email: string, code: string): Promise<Session>;
  /** Exchanges the refresh token for a new session (the old refresh token stops working). */
  refresh(refreshToken: string): Promise<Session>;
  /** Revokes the refresh token on the server. */
  logout(refreshToken?: string): Promise<void>;
}
