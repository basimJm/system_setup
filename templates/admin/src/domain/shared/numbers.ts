import type { Language } from '../../constants/i18n';
import { INTL_LOCALES } from '../../constants/kernel';

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const DIGIT = /[0-9]/g;

/** Rewrites ASCII digits to the digits of `language` ("numerals follow the language"). */
export const localizeDigits = (text: string, language: Language): string =>
  language === 'ar'
    ? text.replace(DIGIT, (digit) => ARABIC_INDIC_DIGITS.charAt(Number(digit)))
    : text;

export const formatNumber = (value: number, language: Language): string =>
  new Intl.NumberFormat(INTL_LOCALES[language]).format(value);
