/** The server's generated admin OpenAPI document: the contract of record (sibling project of this one). */
export const SERVER_SPEC_FILE = '../__SERVER_DIR__/docs/api/openapi.admin.json';

/** Files owned by `npm run api:sync`; paths are relative to the admin project root. */
export const CONTRACT_FILES = {
  snapshot: 'contract/openapi.admin.json',
  dto: 'src/data/contract/generated/dto.ts',
  operations: 'src/data/contract/generated/operations.ts',
} as const;

/** Directory holding generated code: exempt from the 300-line, hardcoded-value and format checks. */
export const GENERATED_DIR = 'src/data/contract/generated';
