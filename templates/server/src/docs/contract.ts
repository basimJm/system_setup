import { createHash } from 'node:crypto';

/** The contract's content without `info` (the version is derived from it; the title is branding). */
export const contractFingerprint = (document: unknown): string => {
  const copy = JSON.parse(JSON.stringify(document)) as { info?: Record<string, unknown> };
  Reflect.deleteProperty(copy, 'info');
  return createHash('sha256').update(JSON.stringify(copy)).digest('hex');
};

/** `1.4.2` → `1.5.0`: every contract change is a minor bump (changes are additive by rule). */
export const nextMinor = (version: string): string => {
  const [major = '1', minor = '0'] = version.split('.');
  return `${major}.${String(Number(minor) + 1)}.0`;
};

/**
 * Replaces one namespace's entry in `contractVersions.ts`: the whole entry up to its own closing
 * line, so a note may contain braces such as `{id}`. Returns the source unchanged when not found.
 */
export const replaceContractEntry = (
  source: string,
  doc: string,
  entry: { version: string; sha256: string; note: string },
): string => {
  const pattern = new RegExp(`  ${doc}: \\{\\n[\\s\\S]*?\\n  \\},`);
  const note = entry.note.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return source.replace(
    pattern,
    () =>
      `  ${doc}: {\n    version: '${entry.version}',\n    sha256: '${entry.sha256}',\n    note: '${note}',\n  },`,
  );
};
