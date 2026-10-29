# ADR-0001 — Contract source and generated DTOs

- **Status:** accepted (template)
- **Context:** The server generates `openapi.admin.json` from its zod schemas, so it cannot drift from the code. The spec has no `operationId`s.
- **Decision:** the committed server OpenAPI is the contract. `npm run api:sync` snapshots it and generates lazy zod factories, inferred types and operation metadata with an in-repo converter (`scripts/lib/jsonSchemaToZod.ts`). Operation ids are derived from method + path.
- **Consequences:** no `openapi-typescript` (its peer range excludes TypeScript 6; zod gives runtime validation and types from one source). When the server changes, run `api:sync` and fix the compile errors. The converter refuses constructs it does not know instead of guessing.
