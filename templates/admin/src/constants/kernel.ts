import type { Language } from './i18n';

/** Business time zone of the platform: every admin date and hour is shown in it (PRD §2). Change per deployment. */
export const BUSINESS_TIME_ZONE = 'Etc/GMT-3';

/** Money: the API sends decimal strings; the panel computes in integer minor units (never floats). */
export const MINOR_UNITS_PER_MAJOR = 1_000;
export const MONEY_DECIMAL_PLACES = 3;
/** Most whole-unit digits whose minor units still fit a safe integer. */
const MAX_WHOLE_DIGITS = String(Math.floor(Number.MAX_SAFE_INTEGER / MINOR_UNITS_PER_MAJOR)).length;
/** `[-]whole[.fraction]`: ASCII digits, no leading zeros, 1-3 decimals when there is a dot. Groups: sign, whole, fraction. */
export const MONEY_STRING_PATTERN = new RegExp(
  `^(-?)(0|[1-9][0-9]{0,${String(MAX_WHOLE_DIGITS - 1)}})(?:\\.([0-9]{1,${String(MONEY_DECIMAL_PLACES)}}))?$`,
);

/** Intl locales: Arabic UI uses Arabic-Indic digits, English uses Latin digits ("numerals follow the language"). */
export const INTL_LOCALES: Readonly<Record<Language, string>> = {
  ar: 'ar-u-nu-arab-ca-gregory',
  en: 'en-GB-u-nu-latn-ca-gregory',
};

export const MS_PER_MINUTE = 60_000;
export const MS_PER_DAY = 86_400_000;
export const MINUTES_PER_DAY = 1_440;
/** `YYYY-MM-DD`: a calendar day with no time zone attached. */
export const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
export const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
