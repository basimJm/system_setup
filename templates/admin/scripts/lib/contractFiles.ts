/** The server's generated admin OpenAPI document: the contract of record (sibling project of this one). */
export const SERVER_SPEC_FILE = '../__SERVER_DIR__/docs/api/openapi.admin.json';

/** `true` while `contract/` holds the starter sample and not the server's contract of this app's audience: run `npm run api:sync`, then set it to `false` so the checks against the server apply. */
export const CONTRACT_IS_SAMPLE = false;

/** Files owned by `npm run api:sync`; paths are relative to the admin project root. */
export const CONTRACT_FILES = {
  snapshot: 'contract/openapi.admin.json',
  dto: 'src/data/contract/generated/dto.ts',
  operations: 'src/data/contract/generated/operations.ts',
} as const;

/** Directory holding generated code: exempt from the 300-line, hardcoded-value and format checks. */
export const GENERATED_DIR = 'src/data/contract/generated';
