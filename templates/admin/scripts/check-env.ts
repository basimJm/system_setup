import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENV_EXAMPLE_FILE, ENV_KEYS } from '../src/constants/env.ts';
import { ENV_SCHEMA_KEYS } from '../src/infrastructure/config/envSchema.ts';
import { compareEnvSources, parseEnvKeys } from './lib/env.ts';

const example = parseEnvKeys(readFileSync(join(process.cwd(), ENV_EXAMPLE_FILE), 'utf8'));
const problems = compareEnvSources({
  example,
  constants: Object.values(ENV_KEYS),
  schema: ENV_SCHEMA_KEYS,
});

if (problems.length > 0) {
  for (const p of problems) console.error(`env contract: ${p}`);
  process.exit(1);
}
console.log(`OK: ${example.length} env keys in sync (.env.example, constants, schema).`);
