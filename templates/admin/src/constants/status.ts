import type { ToneName } from '@/design/tokens/colors';

/**
 * The single source of badge tones for every status enum of BUSINESS_DOMAIN §2 that the admin shows.
 * Labels live in the locale files under `status.<kind>.<VALUE>`. A new enum value = one line here + two labels
 * (tests/status.test.ts fails otherwise); no page decides a tone itself.
 */
export const STATUS_TONES = {
  item: { ACTIVE: 'green', ARCHIVED: 'grey' },
  itemOwner: { CUSTOMER: 'purple', MERCHANT: 'amber' },
} as const satisfies Record<string, Record<string, ToneName>>;

export type StatusTone = ToneName;
export type StatusKind = keyof typeof STATUS_TONES;
export const STATUS_KINDS = Object.keys(STATUS_TONES) as StatusKind[];
/** Tone used for a value the registry does not know yet (the server added one): visible, never a crash. */
export const UNKNOWN_STATUS_TONE: ToneName = 'grey';
export const STATUS_LABEL_PREFIX = 'status';
