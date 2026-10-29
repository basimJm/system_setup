import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  DOC_NAMES,
  DOCS_OUTPUT_DIR,
  POSTMAN_FILE_PREFIX,
  POSTMAN_OUTPUT_DIR,
} from '../constants/docs';
import { buildOpenApiDocuments } from './index';
import { buildPostmanCollection, buildPostmanEnvironment } from './postman';

const POSTMAN_ENVIRONMENT_FILE = `${POSTMAN_FILE_PREFIX}.postman_environment.json`;

const toFile = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const titleCase = (name: string): string => `${name.charAt(0).toUpperCase()}${name.slice(1)}`;

/** Every generated file: relative path (from the server root) → exact content. */
export const generateDocFiles = (): Record<string, string> => {
  const documents = buildOpenApiDocuments();
  const files: Record<string, string> = {};
  for (const name of DOC_NAMES) {
    files[`${DOCS_OUTPUT_DIR}/openapi.${name}.json`] = toFile(documents[name]);
    files[
      `${POSTMAN_OUTPUT_DIR}/${POSTMAN_FILE_PREFIX}-${titleCase(name)}.postman_collection.json`
    ] = toFile(buildPostmanCollection(name, documents[name]));
  }
  files[`${POSTMAN_OUTPUT_DIR}/${POSTMAN_ENVIRONMENT_FILE}`] = toFile(buildPostmanEnvironment());
  return files;
};

/** `npm run docs`: rewrites the generated Swagger and Postman files. */
const main = (): void => {
  const root = resolve(__dirname, '..', '..');
  for (const [relativePath, content] of Object.entries(generateDocFiles())) {
    const target = join(root, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  process.stdout.write('API docs regenerated (docs/api)\n');
};

if (require.main === module) main();
