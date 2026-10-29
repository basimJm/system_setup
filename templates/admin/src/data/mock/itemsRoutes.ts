import * as dto from '../contract/generated/dto';
import { OPERATIONS } from '../contract/generated/operations';
import { defineEndpoint } from '../api/endpoint';
import { mockRoute, type TypedAnswer } from './mockRoute';
import { HTTP_STATUS } from '@/constants/http';
import { MockBusinessError, type MockRequest, type MockRoute } from './mockTransport';

type ItemRow = dto.getItemsData[number];
const O = OPERATIONS;
const ARCHIVED_AT = '2026-10-20T10:00:00.000Z';

type Seed = Pick<ItemRow, 'title' | 'status' | 'tags' | 'owner'> & { description?: string };
const item = (n: number, seed: Seed): ItemRow => ({
  id: `64d1${String(n).padStart(20, '0')}`,
  ...seed,
  imageUrl: null,
  ...(seed.status === 'ARCHIVED'
    ? { archivedReason: 'Kept for the audit trail', archivedAt: ARCHIVED_AT }
    : {}),
  createdAt: `2026-10-${String(n).padStart(2, '0')}T08:00:00.000Z`,
  updatedAt: `2026-10-${String(n).padStart(2, '0')}T09:30:00.000Z`,
});
const CUSTOMER = { type: 'CUSTOMER', id: '64c100000000000000000c01' } as const;
const MERCHANT = { type: 'MERCHANT', id: '64c100000000000000000d01' } as const;
export const MOCK_ITEMS: readonly ItemRow[] = [
  item(1, {
    title: 'Starter plan',
    status: 'ACTIVE',
    tags: ['plan', 'starter'],
    owner: CUSTOMER,
    description: 'The first thing a customer lists',
  }),
  item(2, { title: 'Legacy plan', status: 'ACTIVE', tags: ['plan'], owner: MERCHANT }),
  item(3, {
    title: 'Pilot batch',
    status: 'ARCHIVED',
    tags: ['pilot'],
    owner: MERCHANT,
    description: 'Kept for the audit trail',
  }),
];

function listOf(rows: ItemRow[], { query }: MockRequest): TypedAnswer<ItemRow[]> {
  const q = (query.get('q') ?? '').toLowerCase();
  const status = query.get('status');
  const ownerType = query.get('ownerType');
  const ownerId = query.get('ownerId');
  const tag = query.get('tag');
  const filtered = rows.filter(
    (r) =>
      (!status || r.status === status) &&
      (!ownerType || r.owner.type === ownerType) &&
      (!ownerId || r.owner.id === ownerId) &&
      (!tag || r.tags.includes(tag)) &&
      (!q || r.title.toLowerCase().includes(q)),
  );
  const pageSize = Number(query.get('pageSize') ?? 25);
  const page = Number(query.get('page') ?? 1);
  const start = (page - 1) * pageSize;
  return {
    data: filtered.slice(start, start + pageSize),
    meta: {
      page,
      pageSize,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
    },
    empty: [],
  };
}

/** In-memory items: list (title search, status, owner, tag, paging), read, archive and restore with a reason. */
export function itemsRoutes(): readonly MockRoute[] {
  const rows = MOCK_ITEMS.map((r) => ({ ...r }));
  const find = (id: string | undefined): number => {
    const index = rows.findIndex((r) => r.id === id);
    if (index < 0)
      throw new MockBusinessError(HTTP_STATUS.notFound, 'ITEM_NOT_FOUND', [], 'notFound');
    return index;
  };
  const replace = (index: number, next: ItemRow): TypedAnswer<ItemRow> => {
    rows[index] = next;
    return { data: { ...next } };
  };
  return [
    mockRoute(
      defineEndpoint(O.getItems, { data: dto.getItemsDataSchema, query: dto.getItemsQuerySchema }),
      (request) => listOf(rows, request),
    ),
    mockRoute(
      defineEndpoint(O.getItemsById, { data: dto.getItemsByIdDataSchema }),
      ({ params }) => ({
        data: { ...rows[find(params['id'])]! },
      }),
    ),
    mockRoute(
      defineEndpoint(O.postItemsByIdArchive, {
        data: dto.postItemsByIdArchiveDataSchema,
        body: dto.postItemsByIdArchiveBodySchema,
      }),
      ({ params, body }) => {
        const index = find(params['id']);
        const current = rows[index]!;
        if (current.status === 'ARCHIVED')
          throw new MockBusinessError(HTTP_STATUS.conflict, 'ITEM_ARCHIVED');
        const { reason } = body as { reason: string };
        return replace(index, {
          ...current,
          status: 'ARCHIVED',
          archivedReason: reason,
          archivedAt: ARCHIVED_AT,
          updatedAt: ARCHIVED_AT,
        });
      },
    ),
    mockRoute(
      defineEndpoint(O.postItemsByIdRestore, {
        data: dto.postItemsByIdRestoreDataSchema,
        body: dto.postItemsByIdRestoreBodySchema,
      }),
      ({ params }) => {
        const index = find(params['id']);
        const current = rows[index]!;
        if (current.status !== 'ARCHIVED')
          throw new MockBusinessError(HTTP_STATUS.conflict, 'CONFLICT');
        const restored: ItemRow = { ...current, status: 'ACTIVE', updatedAt: ARCHIVED_AT };
        delete restored.archivedReason;
        delete restored.archivedAt;
        return replace(index, restored);
      },
    ),
  ];
}
