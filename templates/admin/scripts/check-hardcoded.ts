import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { GENERATED_DIR } from './lib/contractFiles.ts';
import { overLimit, scanSource } from './lib/hardcoded.ts';

const ROOT = process.cwd();
const SCAN_DIRS = ['src'];
const SOURCE_EXT = /\.(ts|tsx|css|json)$/;
const MAX_LINES = 300;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)))
  .filter((f) => SOURCE_EXT.test(f) && !relative(ROOT, f).startsWith(GENERATED_DIR))
  .map((f) => ({ file: relative(ROOT, f), content: readFileSync(f, 'utf8') }));

const findings = files.flatMap((f) => scanSource(f.file, f.content));
const long = overLimit(files, MAX_LINES);

for (const f of findings) console.error(`hardcoded [${f.rule}] ${f.file}:${f.line}  ${f.text}`);
for (const l of long) console.error(`too long  ${l.file} has ${l.lines} lines (max ${MAX_LINES})`);

if (findings.length > 0 || long.length > 0) {
  console.error(
    `\n${findings.length} hardcoded value(s), ${long.length} file(s) over ${MAX_LINES} lines.`,
  );
  process.exit(1);
}
console.log(`OK: ${files.length} source files, no hardcoded values, none over ${MAX_LINES} lines.`);
