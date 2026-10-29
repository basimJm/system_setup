/** Customer authentication routes and rules. */
export const CUSTOMER_AUTH_ROUTES = {
  base: '/auth',
  checkPhone: '/check-phone',
  login: '/login',
  register: '/register',
  refresh: '/refresh',
  logout: '/logout',
  changePhone: '/change-phone',
} as const;

/** `check-phone` is asked before the OTP is sent, only for these modes. */
export const PHONE_CHECK_PURPOSES = ['LOGIN', 'REGISTER'] as const;
export type PhoneCheckPurpose = (typeof PHONE_CHECK_PURPOSES)[number];

/** Detail code for a well-formed request field that names something unknown. */
export const FIELD_INVALID_CODE = 'invalid_reference';
