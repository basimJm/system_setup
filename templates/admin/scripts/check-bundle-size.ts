import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import budget from './budget.json' with { type: 'json' };
import { checkBuild, type BuildFile } from './lib/budget.ts';

const DIST = join(process.cwd(), 'dist');
const variants = process.argv.slice(2);
if (variants.length === 0) {
  console.error('Usage: npm run check:size -- <variant> [variant...]');
  process.exit(2);
}

let failed = false;
for (const variant of variants) {
  const dir = join(DIST, variant);
  const names = readdirSync(join(dir, 'assets'));
  const files: BuildFile[] = names.map((name) => {
    const buffer = readFileSync(join(dir, 'assets', name));
    return {
      name,
      gzip: gzipSync(buffer).length,
      content: name.endsWith('.js') ? buffer.toString('utf8') : '',
    };
  });
  const problems = checkBuild({
    files,
    indexHtml: readFileSync(join(dir, 'index.html'), 'utf8'),
    variant,
    budget,
  });
  if (problems.length > 0) {
    failed = true;
    for (const p of problems) console.error(`[${variant}] ${p}`);
  } else {
    console.log(`[${variant}] OK (${files.length} assets within budget)`);
  }
}
process.exit(failed ? 1 : 0);
