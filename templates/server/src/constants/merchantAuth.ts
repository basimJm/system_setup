/** Merchant member authentication routes. */
export const MERCHANT_AUTH_ROUTES = {
  base: '/auth',
  checkPhone: '/check-phone',
  register: '/register',
  login: '/login',
  refresh: '/refresh',
  logout: '/logout',
} as const;
export const BUSINESS_NAME_MIN_LENGTH = 1;
export const BUSINESS_NAME_MAX_LENGTH = 120;
