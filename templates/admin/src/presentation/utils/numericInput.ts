const ARABIC_INDIC_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0;

/** Arabic-Indic and Persian digits typed on an Arabic keyboard -> ASCII digits. */
export function toAsciiDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (ch) => {
    const code = ch.charCodeAt(0);
    const base =
      code >= EXTENDED_ARABIC_INDIC_ZERO ? EXTENDED_ARABIC_INDIC_ZERO : ARABIC_INDIC_ZERO;
    return String(code - base);
  });
}

export interface DecimalOptions {
  maxDecimals: number;
  allowNegative?: boolean;
}

/** Keeps only what can still become a valid decimal: digits, one dot, at most `maxDecimals` after it. */
export function sanitizeDecimal(
  text: string,
  { maxDecimals, allowNegative = false }: DecimalOptions,
): string {
  const ascii = toAsciiDigits(text).replace(/[٫,]/g, '.');
  const negative = allowNegative && ascii.trimStart().startsWith('-');
  const cleaned = ascii.replace(/[^0-9.]/g, '');
  const [whole = '', ...rest] = cleaned.split('.');
  const hasDot = rest.length > 0 && maxDecimals > 0;
  const fraction = rest.join('').slice(0, maxDecimals);
  const body = hasDot ? `${whole}.${fraction}` : whole;
  return negative ? `-${body}` : body;
}
