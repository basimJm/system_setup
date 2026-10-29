/* Consumer smoke test: packs the built SDK, installs the tarball in a temp project and uses it
 * through both `require` (CJS) and `import` (ESM) with the fake adapters.
 * The kind-specific scenario lives in `scripts/smoke.body.cjs` (exports `async (lib) => void`). */
const { execFileSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync, readFileSync, copyFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const work = mkdtempSync(join(tmpdir(), `${pkg.name.replace(/[@/]/g, '-')}-smoke-`));
const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

try {
  const packed = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', work], root));
  const tarball = join(work, packed[0].filename);
  writeFileSync(
    join(work, 'package.json'),
    JSON.stringify({ name: 'consumer', version: '1.0.0', private: true }),
  );
  run('npm', ['install', '--no-audit', '--no-fund', '--silent', tarball], work);

  copyFileSync(join(__dirname, 'smoke.body.cjs'), join(work, 'smoke.body.cjs'));
  writeFileSync(
    join(work, 'cjs.cjs'),
    `require('./smoke.body.cjs')(require('${pkg.name}')).then(() => console.log('cjs ok'));`,
  );
  writeFileSync(
    join(work, 'esm.mjs'),
    [
      `import * as lib from '${pkg.name}';`,
      `import { createRequire } from 'node:module';`,
      `const body = createRequire(import.meta.url)('./smoke.body.cjs');`,
      `body(lib).then(() => console.log('esm ok'));`,
    ].join('\n'),
  );
  process.stdout.write(run('node', ['cjs.cjs'], work));
  process.stdout.write(run('node', ['esm.mjs'], work));
} finally {
  rmSync(work, { recursive: true, force: true });
}
