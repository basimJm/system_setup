import type { z } from 'zod';
import {
  BEARER_PREFIX,
  HTTP_HEADERS,
  HTTP_METHODS,
  HTTP_RETRY,
  HTTP_TIMEOUT_MS,
  JSON_CONTENT_TYPE,
  type HttpMethod,
} from '@/constants/http';
import { HTTP_LANGUAGE_HEADER, type Language } from '@/constants/i18n';
import { AppError } from '../errors/AppError';
import { kindFromResponse, normalizeError } from '../errors/normalize';
import type { Logger } from '../logger/logger';
import { errorEnvelopeSchema, successEnvelope, type ApiResult } from './envelope';

export type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

export interface HttpClientOptions {
  baseUrl: string;
  fetchFn?: FetchFn;
  getToken: () => string | null;
  getLanguage: () => Language;
  /** Called once on a 401 so the session layer can sign out. */
  /** Called when a request is refused as unauthorized and could not be saved by a refresh. */
  onUnauthorized?: () => void;
  /** Runs before each request: refreshes an access token that is about to expire. Must not throw. */
  ensureFresh?: () => Promise<void>;
  /** Called once after a 401: true = the session was refreshed, so the request is repeated with the new token. */
  refreshSession?: () => Promise<boolean>;
  logger?: Logger;
  timeoutMs?: number;
  /** Injectable so tests do not wait for real backoff. */
  sleep?: (ms: number) => Promise<void>;
}

export interface RequestOptions<T> {
  schema: z.ZodType<T>;
  /** A list value is sent as repeated parameters (`status=A&status=B`). */
  query?: Readonly<
    Record<string, string | number | boolean | readonly (string | number | boolean)[] | undefined>
  >;
  /** The auth calls themselves (refresh, logout) never trigger a refresh. */
  noRefresh?: boolean;
  /** Extra request headers (e.g. `Idempotency-Key`). */
  headers?: Readonly<Record<string, string>>;
  body?: unknown;
  signal?: AbortSignal;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const isIdempotent = (method: HttpMethod) => method === HTTP_METHODS[0];

export class HttpClient {
  private readonly opts: HttpClientOptions;

  constructor(opts: HttpClientOptions) {
    this.opts = opts;
  }

  get<T>(path: string, o: RequestOptions<T>) {
    return this.request('GET', path, o);
  }
  post<T>(path: string, o: RequestOptions<T>) {
    return this.request('POST', path, o);
  }
  put<T>(path: string, o: RequestOptions<T>) {
    return this.request('PUT', path, o);
  }
  patch<T>(path: string, o: RequestOptions<T>) {
    return this.request('PATCH', path, o);
  }
  delete<T>(path: string, o: RequestOptions<T>) {
    return this.request('DELETE', path, o);
  }

  /**
   * Sends the request; always rejects with AppError. Before sending it refreshes a token that is about to
   * expire; after a 401 it refreshes the session once and repeats the request, and only then reports the
   * session as unauthorized.
   */
  async request<T>(method: HttpMethod, path: string, o: RequestOptions<T>): Promise<ApiResult<T>> {
    if (!o.noRefresh) await this.opts.ensureFresh?.();
    try {
      return await this.send(method, path, o);
    } catch (e) {
      const error = normalizeError(e);
      if (error.kind !== 'unauthorized') throw error;
      const refreshed =
        !o.noRefresh && this.opts.refreshSession ? await this.opts.refreshSession() : false;
      if (!refreshed) {
        this.opts.onUnauthorized?.();
        throw error;
      }
      try {
        return await this.send(method, path, o);
      } catch (second) {
        const again = normalizeError(second);
        if (again.kind === 'unauthorized') this.opts.onUnauthorized?.();
        throw again;
      }
    }
  }

  /** One logical request: retries idempotent calls on transient failures. */
  private async send<T>(
    method: HttpMethod,
    path: string,
    o: RequestOptions<T>,
  ): Promise<ApiResult<T>> {
    const sleep = this.opts.sleep ?? defaultSleep;
    const attempts = isIdempotent(method) ? HTTP_RETRY.maxAttempts : 1;
    let lastError: AppError | undefined;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await this.once(method, path, o);
      } catch (e) {
        lastError = normalizeError(e);
        const retry = attempt < attempts && this.shouldRetry(lastError);
        this.opts.logger?.warn('http.failed', {
          method,
          path,
          kind: lastError.kind,
          attempt,
          retry,
        });
        if (!retry) break;
        const delay = Math.min(HTTP_RETRY.baseDelayMs * 2 ** (attempt - 1), HTTP_RETRY.maxDelayMs);
        await sleep(delay);
      }
    }
    throw lastError ?? new AppError({ kind: 'unknown' });
  }

  private shouldRetry(error: AppError): boolean {
    if (error.kind === 'network' || error.kind === 'timeout') return true;
    return (
      error.status !== undefined && HTTP_RETRY.retryableStatuses.some((s) => s === error.status)
    );
  }

  private buildUrl(path: string, query: RequestOptions<unknown>['query']): string {
    const url = new URL(path, this.opts.baseUrl);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined) continue;
      if (Array.isArray(value)) value.forEach((item) => url.searchParams.append(key, String(item)));
      else url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  private buildInit(method: HttpMethod, o: RequestOptions<unknown>): RequestInit {
    const headers: Record<string, string> = {
      ...o.headers,
      [HTTP_LANGUAGE_HEADER]: this.opts.getLanguage(),
    };
    const token = this.opts.getToken();
    if (token) headers[HTTP_HEADERS.authorization] = `${BEARER_PREFIX} ${token}`;
    if (o.body !== undefined) headers[HTTP_HEADERS.contentType] = JSON_CONTENT_TYPE;
    const timeout = AbortSignal.timeout(this.opts.timeoutMs ?? HTTP_TIMEOUT_MS);
    const signal = o.signal ? AbortSignal.any([o.signal, timeout]) : timeout;
    return {
      method,
      headers,
      signal,
      ...(o.body !== undefined ? { body: JSON.stringify(o.body) } : {}),
    };
  }

  private async once<T>(
    method: HttpMethod,
    path: string,
    o: RequestOptions<T>,
  ): Promise<ApiResult<T>> {
    const doFetch = this.opts.fetchFn ?? ((input, init) => fetch(input, init));
    const response = await doFetch(this.buildUrl(path, o.query), this.buildInit(method, o));
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) throw this.toError(response.status, payload);
    const parsed = successEnvelope(o.schema).safeParse(payload);
    if (!parsed.success)
      throw new AppError({ kind: 'parse', status: response.status, cause: parsed.error });
    const { data, message, meta } = parsed.data;
    return meta ? { data, message, meta } : { data, message };
  }

  private toError(status: number, payload: unknown): AppError {
    const parsed = errorEnvelopeSchema.safeParse(payload);
    const kind = kindFromResponse(status, parsed.success ? parsed.data.error.code : undefined);
    if (!parsed.success) return new AppError({ kind, status });
    const { message, error } = parsed.data;
    return new AppError({
      kind,
      status,
      code: error.code,
      ...(error.details ? { details: error.details } : {}),
      ...(error.traceId ? { traceId: error.traceId } : {}),
      serverMessage: message,
    });
  }
}
