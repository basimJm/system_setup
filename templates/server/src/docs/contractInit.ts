import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DOC_NAMES } from '../constants/docs';
import { contractFingerprint, replaceContractEntry } from './contract';
import { CONTRACT_VERSIONS } from './contractVersions';
import { buildOpenApiDocuments } from './index';

/**
 * `npm run contract:init`: records the fingerprint of every generated contract at its current version.
 * Run once after the audiences were named for this system (their names are part of the contract), then
 * `npm run docs`. Later API changes use `contract:bump`, which also raises the version.
 */
const main = (): void => {
  const file = resolve(__dirname, '..', '..', 'src', 'docs', 'contractVersions.ts');
  const documents = buildOpenApiDocuments();
  let source = readFileSync(file, 'utf8');
  for (const name of DOC_NAMES) {
    const current = CONTRACT_VERSIONS[name];
    const sha256 = contractFingerprint(documents[name]);
    source = replaceContractEntry(source, name, { version: current.version, sha256, note: current.note });
  }
  writeFileSync(file, source);
  process.stdout.write(`recorded the contract fingerprints of ${DOC_NAMES.join(', ')}\n`);
};

main();
