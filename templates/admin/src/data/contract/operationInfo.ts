export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

/** One server operation as described by the OpenAPI snapshot. */
export interface OperationInfo {
  readonly id: string;
  readonly method: HttpMethod;
  readonly path: string;
  readonly tag: string;
  readonly summary: string;
  /** Success status code (200, 201). */
  readonly status: number;
  readonly hasBody: boolean;
  readonly hasQuery: boolean;
  /** True for paginated lists (response carries `meta`). */
  readonly hasMeta: boolean;
}
