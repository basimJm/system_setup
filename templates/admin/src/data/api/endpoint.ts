import type { z } from 'zod';
import type { OperationInfo } from '../contract/operationInfo';

/** Lazy zod factories from the generated DTOs (`postAuthLoginDataSchema`, ...): only the ones a feature imports are bundled. */
export interface EndpointSchemas<TData, TBody, TQuery> {
  data: () => z.ZodType<TData>;
  body?: () => z.ZodType<TBody>;
  query?: () => z.ZodType<TQuery>;
}

export interface EndpointOptions {
  /** Money or state-changing command: the client adds a fresh `Idempotency-Key` unless the caller passes one. */
  idempotent?: boolean;
  /** Session-less call (sign-in, refresh, sign-out): a 401 must not trigger a token refresh. */
  noRefresh?: boolean;
}

export interface Endpoint<TData, TBody = undefined, TQuery = undefined> {
  readonly op: OperationInfo;
  readonly schemas: EndpointSchemas<TData, TBody, TQuery>;
  readonly idempotent: boolean;
  readonly noRefresh: boolean;
}

/**
 * Ties a generated operation (path, method, shape flags) to its generated schemas. Fails at definition time
 * when the schemas disagree with the contract (a body schema for an operation without a body, or the reverse),
 * so a contract change is caught by the first test that imports the endpoint.
 */
export function defineEndpoint<TData, TBody = undefined, TQuery = undefined>(
  op: OperationInfo,
  schemas: EndpointSchemas<TData, TBody, TQuery>,
  options: EndpointOptions = {},
): Endpoint<TData, TBody, TQuery> {
  if (op.hasBody !== (schemas.body !== undefined))
    throw new RangeError(
      `${op.id}: body schema does not match the contract (hasBody=${String(op.hasBody)})`,
    );
  if (op.hasQuery !== (schemas.query !== undefined))
    throw new RangeError(
      `${op.id}: query schema does not match the contract (hasQuery=${String(op.hasQuery)})`,
    );
  return {
    op,
    schemas,
    idempotent: options.idempotent ?? false,
    noRefresh: options.noRefresh ?? false,
  };
}

/**
 * A generated query schema whose parameters are all optional, accepting no query at all: callers may pass
 * `query: undefined` when the list takes no filter.
 */
export const optionalQuery =
  <T extends z.ZodType>(schema: () => T) =>
  () =>
    schema().optional();

const PLACEHOLDER = /\{([A-Za-z0-9_]+)\}/g;

/** Names of the `{placeholders}` in a path template. */
export const pathParamNames = (template: string): string[] =>
  [...template.matchAll(PLACEHOLDER)].map((m) => m[1] ?? '');

/** Fills `/items/{id}` from `{ id }`, encoding each value; a missing value is a programmer error. */
export function buildPath(template: string, params: Readonly<Record<string, string>> = {}): string {
  return template.replace(PLACEHOLDER, (_whole, name: string) => {
    const value = params[name];
    if (value === undefined || value === '')
      throw new RangeError(`missing path parameter "${name}" for ${template}`);
    return encodeURIComponent(value);
  });
}
