import { readFileSync } from 'node:fs';
import { checkEnvText } from './checkEnv';

const EXIT_OK = 0;
const EXIT_INVALID = 1;
const EXIT_USAGE = 2;
const FILE_ARGUMENT_INDEX = 2;

/** `npm run env:check -- <env file>`: prints PASS or the invalid key names, never values. */
const main = (): number => {
  const file = process.argv[FILE_ARGUMENT_INDEX];
  if (file === undefined) {
    process.stderr.write('usage: npm run env:check -- <env file>\n');
    return EXIT_USAGE;
  }
  const result = checkEnvText(readFileSync(file, 'utf8'));
  if (result.ok) {
    process.stdout.write(`PASS ${file}\n`);
    return EXIT_OK;
  }
  process.stderr.write(`FAIL ${file}: ${String(result.invalidKeys.length)} problem(s)\n`);
  for (const problem of result.problems) {
    process.stderr.write(`  - ${problem.key} ${problem.reason}\n`);
  }
  return EXIT_INVALID;
};

process.exitCode = main();
