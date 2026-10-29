import { ERROR_CODES, HTTP, HTTP_STATUS } from '../constants/analytics';
import type { FetchLike } from '../config/options';
import { SdkError } from '../errors';
import { withTimeout } from '../retry';
import type { AnalyticsSink, Envelope } from '../types';

const NAME = 'http';

export interface HttpSinkOptions {
  readonly endpoint: string;
  readonly apiKey: string | undefined;
  readonly timeoutMs: number;
  readonly fetch: FetchLike;
}

/** Every status the collector can answer, mapped (Rules.md §3.8). */
export const mapStatus = (status: number): SdkError | 'ok' => {
  if (status >= HTTP_STATUS.okMin && status <= HTTP_STATUS.okMax) return 'ok';
  const fail = (code: string, message: string, retryable = false): SdkError =>
    new SdkError(code, message, { retryable, details: { status } });
  if (status === HTTP_STATUS.unauthorized || status === HTTP_STATUS.forbidden)
    return fail(ERROR_CODES.AUTH_FAILED, 'collector refused the credentials');
  if (status === HTTP_STATUS.tooManyRequests)
    return fail(ERROR_CODES.RATE_LIMITED, 'collector is throttling', true);
  if (status >= HTTP_STATUS.serverErrorMin)
    return fail(ERROR_CODES.UNAVAILABLE, 'collector is unavailable', true);
  return fail(ERROR_CODES.VENDOR_ERROR, `collector rejected the batch (${String(status)})`);
};

/** Posts JSON batches `{ events: Envelope[] }` to a generic collector (warehouse ingest, proxy, vendor). */
export class HttpSink implements AnalyticsSink {
  readonly name = NAME;

  constructor(private readonly options: HttpSinkOptions) {}

  async deliver(batch: readonly Envelope[]): Promise<void> {
    const headers: Record<string, string> = { [HTTP.headers.contentType]: HTTP.json };
    if (this.options.apiKey !== undefined)
      headers[HTTP.headers.authorization] = `${HTTP.bearer}${this.options.apiKey}`;
    const response = await withTimeout(
      this.options
        .fetch(this.options.endpoint, {
          method: HTTP.method,
          headers,
          body: JSON.stringify({ events: batch }),
        })
        .catch((error: unknown) => {
          throw new SdkError(ERROR_CODES.NETWORK_ERROR, 'collector unreachable', {
            retryable: true,
            cause: error,
          });
        }),
      this.options.timeoutMs,
    );
    const outcome = mapStatus(response.status);
    if (outcome !== 'ok') throw outcome;
  }
}
