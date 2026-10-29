import type { z } from 'zod';
import type { HttpClient, RequestOptions } from '@/infrastructure/http/HttpClient';
import { HTTP_HEADERS, type HttpMethod } from '@/constants/http';
import type { Page } from '@/domain/shared/page';
import { AppError, type FieldIssue } from '@/infrastructure/errors/AppError';
import type { ApiResult } from '@/infrastructure/http/envelope';
import { buildPath, type Endpoint } from './endpoint';
import { newIdempotencyKey } from './idempotency';

export interface CallArgs<TBody, TQuery> {
  /** Values for the `{placeholders}` of the path. */
  params?: Readonly<Record<string, string>>;
  query?: TQuery;
  body?: TBody;
  /** TanStack Query passes its signal here so unmounting a page aborts the request. */
  signal?: AbortSignal;
  /** Overrides the key an idempotent endpoint would generate (reuse it when retrying the same command). */
  idempotencyKey?: string;
}

type QueryValue = NonNullable<RequestOptions<unknown>['query']>;

/** Zod issues -> the same per-field list the server sends (`body.name.ar`), so forms handle both the same way. */
const issuesOf = (issues: readonly z.core.$ZodIssue[], part: string): FieldIssue[] =>
  issues.map((i) => ({
    field: [part, ...i.path.map(String)].join('.'),
    code: i.code,
    message: i.message,
  }));

/**
 * The one door to the admin API for repositories: builds the path, checks the body and query against the
 * generated schemas before sending, aborts with the caller's signal, and returns the validated response.
 * Endpoint paths and shapes come only from the generated contract (`defineEndpoint`).
 */
export class ApiClient {
  constructor(private readonly http: HttpClient) {}

  async execute<TData, TBody, TQuery>(
    endpoint: Endpoint<TData, TBody, TQuery>,
    args: CallArgs<TBody, TQuery> = {},
  ): Promise<ApiResult<TData>> {
    const { op, schemas } = endpoint;
    const body = this.check(schemas.body, args.body, 'body');
    const query = this.check(schemas.query, args.query, 'query');
    const key = args.idempotencyKey ?? (endpoint.idempotent ? newIdempotencyKey() : undefined);
    return this.http.request(
      op.method.toUpperCase() as HttpMethod,
      buildPath(op.path, args.params),
      {
        schema: schemas.data(),
        ...(query !== undefined ? { query: query as QueryValue } : {}),
        ...(body !== undefined ? { body } : {}),
        ...(args.signal ? { signal: args.signal } : {}),
        ...(endpoint.noRefresh ? { noRefresh: true } : {}),
        ...(key ? { headers: { [HTTP_HEADERS.idempotencyKey]: key } } : {}),
      },
    );
  }

  /** For list endpoints: the items with their pagination meta (a list answer without meta is a contract break). */
  async executePage<TItem, TBody, TQuery>(
    endpoint: Endpoint<readonly TItem[], TBody, TQuery>,
    args: CallArgs<TBody, TQuery> = {},
  ): Promise<Page<TItem>> {
    const { data, meta } = await this.execute(endpoint, args);
    if (!meta) throw new AppError({ kind: 'parse', code: 'MISSING_PAGINATION_META' });
    return { items: data, meta };
  }

  private check<T>(
    schema: (() => z.ZodType<T>) | undefined,
    value: unknown,
    part: string,
  ): T | undefined {
    if (!schema) return undefined;
    const parsed = schema().safeParse(value);
    if (parsed.success) return parsed.data;
    throw new AppError({
      kind: 'validation',
      code: 'VALIDATION_ERROR',
      details: issuesOf(parsed.error.issues, part),
    });
  }
}
