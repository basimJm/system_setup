import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { renderDto, renderOperations, sha256, type Spec } from './lib/contract.ts';
import { CONTRACT_FILES, SERVER_SPEC_FILE } from './lib/contractFiles.ts';

const ROOT = process.cwd();
const CHECK_FLAG = '--check';
const checkOnly = process.argv.includes(CHECK_FLAG);

const serverSpec = join(ROOT, SERVER_SPEC_FILE);
if (!existsSync(serverSpec)) {
  console.error(`api:sync: server spec not found at ${SERVER_SPEC_FILE}`);
  process.exit(1);
}

const snapshotPath = join(ROOT, CONTRACT_FILES.snapshot);
const serverText = readFileSync(serverSpec, 'utf8');
const sha = sha256(serverText);
const spec = JSON.parse(serverText) as Spec;
const outputs: ReadonlyArray<readonly [string, string]> = [
  [CONTRACT_FILES.snapshot, serverText],
  [CONTRACT_FILES.dto, renderDto(spec, sha)],
  [CONTRACT_FILES.operations, renderOperations(spec, sha)],
];

const stale = outputs.filter(([file, text]) => {
  const path = join(ROOT, file);
  return !existsSync(path) || readFileSync(path, 'utf8') !== text;
});

if (checkOnly) {
  for (const [file] of stale) console.error(`api:check: ${file} is stale, run "npm run api:sync"`);
  if (stale.length > 0) process.exit(1);
  console.log(
    `OK: contract snapshot and generated files match the server spec (${sha.slice(0, 12)}).`,
  );
} else {
  for (const [file, text] of stale) {
    const path = join(ROOT, file);
    mkdirSync(dirname(path), { recursive: true });
    if (file === CONTRACT_FILES.snapshot) copyFileSync(serverSpec, snapshotPath);
    else writeFileSync(path, text);
  }
  console.log(`api:sync: ${stale.length} file(s) updated (${sha.slice(0, 12)}).`);
}
