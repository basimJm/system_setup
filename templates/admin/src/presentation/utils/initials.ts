const MAX_INITIALS = 2;

/** Up to two initials of a person or organisation name ("Layth Al-Hasan" -> "LA"; Arabic names work the same way). */
export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/[\s\-_.]+/u)
    .filter(Boolean);
  return words
    .slice(0, MAX_INITIALS)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .toLocaleUpperCase();
}
