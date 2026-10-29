import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const ROOT = process.cwd();

export function listFiles(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory()
      ? listFiles(full, pattern)
      : pattern.test(full)
        ? [full]
        : [];
  });
}

export const read = (file: string): string => readFileSync(file, 'utf8');
export const rel = (file: string): string => relative(ROOT, file);
export const SRC = join(ROOT, 'src');
