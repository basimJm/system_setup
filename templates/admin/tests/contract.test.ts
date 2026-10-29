import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  operationId,
  readOperations,
  renderDto,
  renderOperations,
  sha256,
  SHA_MARKER,
  type Spec,
} from '../scripts/lib/contract.ts';
import { CONTRACT_FILES, SERVER_SPEC_FILE } from '../scripts/lib/contractFiles.ts';
import { OPERATIONS } from '../src/data/contract/generated/operations';
import {
  components,
  getItemsDataSchema,
  postAuthLoginBodySchema,
  postAuthLoginDataSchema,
} from '../src/data/contract/generated/dto';
import { ROOT } from './helpers/files';

const text = (file: string) => readFileSync(join(ROOT, file), 'utf8');
// The server project is a sibling checkout; without it the committed snapshot is the contract of record.
const hasServerSpec = existsSync(join(ROOT, SERVER_SPEC_FILE));
const serverText = text(hasServerSpec ? SERVER_SPEC_FILE : CONTRACT_FILES.snapshot);
const spec = JSON.parse(serverText) as Spec;
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

describe('contract snapshot', () => {
  it.skipIf(!hasServerSpec)(
    'equals the server spec (run `npm run api:sync` when the server changed)',
    () => {
      expect(text(CONTRACT_FILES.snapshot)).toBe(serverText);
    },
  );

  it('generated files are exactly what the generator produces now, and carry the spec hash', () => {
    const sha = sha256(serverText);
    expect(text(CONTRACT_FILES.dto)).toBe(renderDto(spec, sha));
    expect(text(CONTRACT_FILES.operations)).toBe(renderOperations(spec, sha));
    expect(text(CONTRACT_FILES.dto)).toContain(`${SHA_MARKER} ${sha}`);
  });

  it.skipIf(!hasServerSpec)('`npm run api:check` passes on the repository', () => {
    expect(() =>
      execFileSync('node', ['scripts/api-sync.ts', '--check'], { cwd: ROOT, stdio: 'pipe' }),
    ).not.toThrow();
  });
});

describe('operations', () => {
  const expected = Object.values(spec.paths).flatMap((item) =>
    Object.keys(item).filter((key) => METHODS.includes(key)),
  );

  it('registers every operation of the spec exactly once', () => {
    expect(Object.keys(OPERATIONS)).toHaveLength(expected.length);
    expect(readOperations(spec)).toHaveLength(expected.length);
  });

  it.each([
    ['post', '/admin/v1/auth/login', 'postAuthLogin'],
    ['get', '/admin/v1/items/{id}', 'getItemsById'],
    ['post', '/admin/v1/items/{id}/archive', 'postItemsByIdArchive'],
    ['post', '/admin/v1/uploads/presign', 'postUploadsPresign'],
    ['get', '/admin/v1/audit-logs', 'getAuditLogs'],
  ] as const)('%s %s is named %s', (method, path, id) => {
    expect(operationId(method, path)).toBe(id);
  });

  it('marks paginated lists with meta and records the success status', () => {
    expect(OPERATIONS.getItems.hasMeta).toBe(true);
    expect(OPERATIONS.postAuthLogin.hasMeta).toBe(false);
    expect(OPERATIONS.postAuthLogin.hasBody).toBe(true);
    expect(OPERATIONS.getItems.hasQuery).toBe(true);
    expect(OPERATIONS.postAuthLogin.status).toBe(200);
  });

  it('fails the build on duplicate ids and on operations without a JSON success response', () => {
    const op = { responses: { '200': { content: { 'application/json': { schema: {} } } } } };
    const dup: Spec = { paths: { '/admin/v1/a-b': { get: op }, '/admin/v1/a/b': { get: op } } };
    expect(() => readOperations(dup)).toThrow('Duplicate operation id');
    const none: Spec = { paths: { '/admin/v1/x': { get: { responses: { '204': {} } } } } };
    expect(() => readOperations(none)).toThrow('no JSON success response');
  });
});

describe('generated DTOs behave like the server contract', () => {
  it('accepts a valid login response and rejects a bad one', () => {
    const data = {
      otpRequired: true,
      expiresAt: '2026-10-14T10:00:00.000Z',
      resendAfterSeconds: 60,
    };
    expect(postAuthLoginDataSchema().safeParse(data).success).toBe(true);
    expect(postAuthLoginDataSchema().safeParse({ ...data, resendAfterSeconds: 'x' }).success).toBe(
      false,
    );
    expect(postAuthLoginDataSchema().safeParse({ ...data, expiresAt: 'tomorrow' }).success).toBe(
      false,
    );
  });

  it('enforces request limits from the spec', () => {
    const ok = { email: 'admin@example.test', password: 'secret' };
    expect(postAuthLoginBodySchema().safeParse(ok).success).toBe(true);
    expect(postAuthLoginBodySchema().safeParse({ ...ok, email: 'not-an-email' }).success).toBe(
      false,
    );
    expect(postAuthLoginBodySchema().safeParse({ ...ok, password: '' }).success).toBe(false);
  });

  it('handles nullable fields and enums in list items, and shared components', () => {
    const item = {
      id: '1',
      title: 'Starter plan',
      tags: ['plan'],
      imageUrl: null,
      status: 'ACTIVE',
      owner: { type: 'CUSTOMER', id: '64c100000000000000000c01' },
      createdAt: '2026-10-14T10:00:00.000Z',
      updatedAt: '2026-10-14T10:00:00.000Z',
    };
    expect(getItemsDataSchema().safeParse([item]).success).toBe(true);
    expect(getItemsDataSchema().safeParse([{ ...item, status: 'NOPE' }]).success).toBe(false);
    expect(components.PaginationMeta().safeParse({ page: 1, pageSize: 25, total: 0 }).success).toBe(
      true,
    );
  });
});
