import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  API_DOC_FILE,
  API_EXEMPTIONS_FILE,
  buildApiDoc,
  findConsumers,
  parseAppendixA,
} from './lib/apiDoc.ts';
import { readOperations, type Spec } from './lib/contract.ts';
import { CONTRACT_FILES, GENERATED_DIR } from './lib/contractFiles.ts';

const ROOT = process.cwd();
const TASKS_FILE = 'docs/Admin_Tasks.md';
const SOURCE_DIR = 'src';
const MOCK_DIR = 'src/data/mock';
const checkOnly = process.argv.includes('--check');

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (statSync(join(ROOT, path)).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const spec = JSON.parse(readFileSync(join(ROOT, CONTRACT_FILES.snapshot), 'utf8')) as Spec;
const files = sourceFiles(SOURCE_DIR)
  .filter((p) => !p.startsWith(GENERATED_DIR) && !p.startsWith(MOCK_DIR))
  .map((path) => ({ path: relative('.', path), text: readFileSync(join(ROOT, path), 'utf8') }));
const exemptions = JSON.parse(readFileSync(join(ROOT, API_EXEMPTIONS_FILE), 'utf8')) as Record<
  string,
  string
>;
const { markdown, problems } = buildApiDoc({
  operations: readOperations(spec).map((o) => o.info),
  appendixA: parseAppendixA(readFileSync(join(ROOT, TASKS_FILE), 'utf8')),
  consumers: findConsumers(files),
  exemptions,
});

for (const p of problems) console.error(`docs:api: ${p}`);
const target = join(ROOT, API_DOC_FILE);
if (checkOnly) {
  const stale = !existsSync(target) || readFileSync(target, 'utf8') !== markdown;
  if (stale) console.error(`docs:api: ${API_DOC_FILE} is stale, run "npm run docs:api"`);
  if (stale || problems.length > 0) process.exit(1);
  console.log(`OK: ${API_DOC_FILE} is current.`);
} else {
  writeFileSync(target, markdown);
  console.log(`wrote ${API_DOC_FILE}`);
  if (problems.length > 0) process.exit(1);
}
