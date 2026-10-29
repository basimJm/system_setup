/** `7`, 2 → `"07"`. */
export const padNumber = (value: number, digits: number): string =>
  String(value).padStart(digits, '0');
