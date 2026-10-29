/** `npm run seed:admin`: the credentials come from the environment, never from the repo. */
export const ADMIN_SEED_ENV = { email: 'ADMIN_EMAIL', password: 'ADMIN_PASSWORD' } as const;
export const ADMIN_SEED_MIN_PASSWORD_LENGTH = 12;
