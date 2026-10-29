import {
  MOCK_ACCEPT_LANGUAGE_HEADER,
  MOCK_ERROR_SCENARIOS,
  MOCK_LATENCY_MS,
  MOCK_SLOW_LATENCY_MS,
  MOCK_TRACE_PREFIX,
  MOCK_VALIDATION_FIELD,
  type MockScenario,
} from '@/constants/mock';
import { HTTP_STATUS, JSON_CONTENT_TYPE, HTTP_HEADERS } from '@/constants/http';
import { DEFAULT_LANGUAGE, type Language } from '@/constants/i18n';
import type { FetchFn } from '@/infrastructure/http/HttpClient';
import { mockMessage } from './messages';
import type { ScenarioStore } from './scenarios';

export interface MockRoute {
  readonly method: string;
  /** Contract path template, e.g. `/admin/v1/items/{id}`. */
  readonly path: string;
  /** Success answer (already typed by the endpoint it was built from). */
  readonly respond: (request: MockRequest) => MockAnswer;
}

export interface MockRequest {
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
}

export interface MockAnswer {
  data: unknown;
  status?: number;
  /** Present for list answers. */
  meta?: { page: number; pageSize: number; total: number; totalPages: number };
  /** What the `empty` scenario returns instead of `data` (default `[]` for lists, `null` otherwise). */
  empty?: unknown;
}

export interface MockTransportOptions {
  routes: readonly MockRoute[];
  scenarios: ScenarioStore;
  sleep?: (ms: number) => Promise<void>;
  latencyMs?: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
interface CompiledRoute {
  route: MockRoute;
  matcher: RegExp;
  names: string[];
}
const SEGMENT = /\{[A-Za-z0-9_]+\}/g;
const SEGMENT_PATTERN = '([^/]+)';

const toMatcher = (template: string) =>
  new RegExp(
    `^${template.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(SEGMENT, SEGMENT_PATTERN)}$`,
  );
const namesOf = (template: string) => [...template.matchAll(SEGMENT)].map((m) => m[0].slice(1, -1));

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { [HTTP_HEADERS.contentType]: JSON_CONTENT_TYPE },
  });

const languageOf = (init: RequestInit): Language => {
  const raw = new Headers(init.headers).get(MOCK_ACCEPT_LANGUAGE_HEADER);
  return raw === 'en' || raw === 'ar' ? raw : DEFAULT_LANGUAGE;
};

function errorResponse(
  scenario: keyof typeof MOCK_ERROR_SCENARIOS,
  language: Language,
  traceSeed: number,
): Response {
  const { status, code } = MOCK_ERROR_SCENARIOS[scenario];
  return json(status, {
    success: false,
    message: mockMessage(language, scenario),
    error: {
      code,
      traceId: `${MOCK_TRACE_PREFIX}${String(traceSeed)}`,
      ...(scenario === 'validation'
        ? {
            details: [
              {
                field: MOCK_VALIDATION_FIELD,
                code: 'invalid',
                message: mockMessage(language, 'field'),
              },
            ],
          }
        : {}),
    },
  });
}

/**
 * Thrown by a fixture to answer like the server refusing a business rule (409/422 with a domain code and, for
 * example, the blocking record ids in `details[].field`).
 */
export class MockBusinessError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly fields: readonly string[] = [],
    /** A message of `messages.ts` when the server words this refusal itself. */
    readonly messageKey?: string,
  ) {
    super(code);
  }
}

function businessErrorResponse(e: MockBusinessError, language: Language, traceSeed: number) {
  return json(e.status, {
    success: false,
    message: mockMessage(
      language,
      e.messageKey ?? (e.status === HTTP_STATUS.conflict ? 'conflict' : 'unprocessable'),
    ),
    error: {
      code: e.code,
      traceId: `${MOCK_TRACE_PREFIX}${String(traceSeed)}`,
      ...(e.fields.length > 0
        ? { details: e.fields.map((field) => ({ field, code: e.code, message: e.code })) }
        : {}),
    },
  });
}

const isErrorScenario = (s: MockScenario): s is keyof typeof MOCK_ERROR_SCENARIOS =>
  s in MOCK_ERROR_SCENARIOS;

/** Never answers; ends the way `fetch` does when its signal fires (a TimeoutError or AbortError). */
function hangUntilAborted(signal: AbortSignal | null | undefined): Promise<Response> {
  return new Promise<Response>((_resolve, reject) => {
    const abort = () => {
      const timedOut = (signal?.reason as { name?: string } | undefined)?.name === 'TimeoutError';
      reject(new DOMException('aborted', timedOut ? 'TimeoutError' : 'AbortError'));
    };
    if (signal?.aborted) abort();
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function findRoute(compiled: CompiledRoute[], method: string, pathname: string) {
  for (const entry of compiled) {
    const match = entry.route.method.toUpperCase() === method ? entry.matcher.exec(pathname) : null;
    if (!match) continue;
    const params = Object.fromEntries(
      entry.names.map((n, i) => [n, decodeURIComponent(match[i + 1] ?? '')]),
    );
    return { route: entry.route, params };
  }
  return null;
}

/** The success envelope of an answer; the `empty` scenario swaps the data for its empty form. */
function successResponse(answer: MockAnswer, empty: boolean, language: Language): Response {
  const data = empty ? (answer.empty ?? (answer.meta ? [] : null)) : answer.data;
  const meta = answer.meta && empty ? { ...answer.meta, total: 0, totalPages: 0 } : answer.meta;
  return json(answer.status ?? HTTP_STATUS.ok, {
    success: true,
    message: mockMessage(language, 'ok'),
    data,
    ...(meta ? { meta } : {}),
  });
}

/**
 * A `fetch` replacement for the real `HttpClient`: same URLs, headers, envelopes and error shapes as the server,
 * so every repository, validator and error path is exercised exactly as in production. The scenario store
 * decides whether a call succeeds, is empty, fails with a given status, hangs or is slow.
 */
export function createMockTransport(options: MockTransportOptions): FetchFn {
  const sleep = options.sleep ?? defaultSleep;
  const latency = options.latencyMs ?? MOCK_LATENCY_MS;
  // Like a real router, a fixed path (`/alerts/count`) wins over a parameter path (`/alerts/{id}`).
  const compiled = options.routes
    .map((route) => ({
      route,
      matcher: toMatcher(route.path),
      names: namesOf(route.path),
    }))
    .sort((x, y) => x.names.length - y.names.length);
  let calls = 0;

  return async (input, init) => {
    calls += 1;
    const scenario = options.scenarios.get();
    const language = languageOf(init);
    if (scenario === 'timeout') return hangUntilAborted(init.signal);
    await sleep(scenario === 'slow' ? MOCK_SLOW_LATENCY_MS : latency);
    if (isErrorScenario(scenario)) return errorResponse(scenario, language, calls);

    const url = new URL(input);
    const method = (init.method ?? 'GET').toUpperCase();
    const found = findRoute(compiled, method, url.pathname);
    if (!found) return errorResponse('notFound', language, calls);
    const body: unknown =
      typeof init.body === 'string' && init.body ? JSON.parse(init.body) : undefined;
    let answer: MockAnswer;
    try {
      answer = found.route.respond({ params: found.params, query: url.searchParams, body });
    } catch (error) {
      if (error instanceof MockBusinessError) return businessErrorResponse(error, language, calls);
      // A fixture that cannot find the record answers like the server: not found.
      return errorResponse('notFound', language, calls);
    }
    return successResponse(answer, scenario === 'empty', language);
  };
}
