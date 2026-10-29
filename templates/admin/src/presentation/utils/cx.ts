export const cx = (...parts: ReadonlyArray<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');
