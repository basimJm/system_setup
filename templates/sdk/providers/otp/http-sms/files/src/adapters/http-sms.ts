import { KERNEL_ERROR_CODES } from '../constants/codes';
import { SdkError } from '../errors';
import type { OtpChannel, OtpMessage } from '../types';

/** The slice of `fetch` used here (tests, proxies and local mocks inject their own). */
export type FetchLike = (
  url: string,
  init: {
    readonly method: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly body: string;
    readonly signal: AbortSignal;
  },
) => Promise<{ readonly status: number; text(): Promise<string> }>;

export interface HttpSmsOptions {
  readonly url: string;
  readonly apiKey: string;
  /** Sender id or number shown to the recipient; omitted from the request when absent. */
  readonly sender?: string;
  /** The wording belongs to the consumer: language, brand and expiry text are not decided here. */
  readonly render: (message: OtpMessage) => string;
  readonly timeoutMs?: number;
  readonly fetch?: FetchLike;
}

const HTTP = {
  okFrom: 200,
  okTo: 299,
  unauthorized: 401,
  forbidden: 403,
  tooManyRequests: 429,
  serverErrorFrom: 500,
  defaultTimeoutMs: 10_000,
  timeoutNames: ['TimeoutError', 'AbortError'],
} as const;

/** Every HTTP status the gateway can answer, mapped to a typed error (`undefined` = accepted). */
export const mapSmsStatus = (status: number): SdkError | undefined => {
  if (status >= HTTP.okFrom && status <= HTTP.okTo) return undefined;
  const fail = (code: string, message: string, retryable = false): SdkError =>
    new SdkError(code, message, { retryable, details: { status } });
  if (status === HTTP.unauthorized || status === HTTP.forbidden)
    return fail(KERNEL_ERROR_CODES.AUTH_FAILED, 'the SMS gateway refused the credentials');
  if (status === HTTP.tooManyRequests)
    return fail(KERNEL_ERROR_CODES.RATE_LIMITED, 'the SMS gateway is throttling', true);
  if (status >= HTTP.serverErrorFrom)
    return fail(KERNEL_ERROR_CODES.UNAVAILABLE, 'the SMS gateway is unavailable', true);
  return fail(
    KERNEL_ERROR_CODES.VENDOR_ERROR,
    `the SMS gateway rejected the message (${String(status)})`,
  );
};

const idOf = (text: string): string | undefined => {
  try {
    const body = JSON.parse(text) as Record<string, unknown> | null;
    const id = body?.['id'] ?? body?.['messageId'];
    return typeof id === 'string' || typeof id === 'number' ? String(id) : undefined;
  } catch {
    return undefined;
  }
};

/** An SMS through any gateway with a JSON HTTP API; never retries by itself (the OTP service decides). */
export class HttpSmsChannel implements OtpChannel {
  readonly name = 'http-sms';
  private readonly send_: FetchLike;

  constructor(private readonly options: HttpSmsOptions) {
    this.send_ = options.fetch ?? ((url, init) => fetch(url, init));
  }

  async send(message: OtpMessage): Promise<{ readonly id: string }> {
    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await this.send_(this.options.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.options.apiKey}`,
        },
        body: JSON.stringify({
          to: message.to,
          text: this.options.render(message),
          ...(this.options.sender === undefined ? {} : { from: this.options.sender }),
        }),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? HTTP.defaultTimeoutMs),
      });
    } catch (error) {
      const name =
        typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : '';
      const timedOut = (HTTP.timeoutNames as readonly string[]).includes(name);
      throw new SdkError(
        timedOut ? KERNEL_ERROR_CODES.TIMEOUT : KERNEL_ERROR_CODES.NETWORK_ERROR,
        timedOut ? 'the SMS gateway timed out' : 'the SMS gateway is unreachable',
        { retryable: true, cause: error },
      );
    }
    const failure = mapSmsStatus(response.status);
    if (failure !== undefined) throw failure;
    const id = idOf(await response.text());
    if (id === undefined)
      throw new SdkError(
        KERNEL_ERROR_CODES.MALFORMED_RESPONSE,
        'the SMS gateway answered without an id',
      );
    return { id };
  }
}
