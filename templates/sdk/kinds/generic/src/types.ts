import type { ResultStatus } from './constants/sdk';

/** What the business asks of this SDK. Rename `operation` and shape `payload` once the BRD is written. */
export interface __SDK_TITLE__Request {
  readonly operation: string;
  readonly payload: Readonly<Record<string, string | number | boolean>>;
}

export interface __SDK_TITLE__Result {
  readonly id: string;
  readonly status: ResultStatus;
}

/** The port: every vendor, fake and local adapter implements this and is chosen by configuration. */
export interface __SDK_TITLE__Port {
  readonly name: string;
  readonly isFake?: boolean;
  /** Rejects with `SdkError`; mark an error `retryable` only when repeating the call is safe. */
  execute(request: __SDK_TITLE__Request): Promise<__SDK_TITLE__Result>;
  close?(): Promise<void>;
}

/** The facade the consumer uses: validation, timeout, retries and typed errors around the port. */
export interface __SDK_TITLE__Client {
  execute(request: __SDK_TITLE__Request): Promise<__SDK_TITLE__Result>;
  close(): Promise<void>;
}
