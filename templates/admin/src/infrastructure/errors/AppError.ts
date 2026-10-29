import { ERROR_CODE_MESSAGE_PREFIX, isErrorCode } from '@/constants/errorCatalog';
import { ERROR_MESSAGE_PREFIX, type ErrorKind } from '@/constants/errors';

export interface FieldIssue {
  readonly field: string;
  readonly code?: string;
  readonly message?: string;
}

export interface AppErrorInit {
  kind: ErrorKind;
  status?: number;
  code?: string;
  details?: readonly FieldIssue[];
  traceId?: string;
  cause?: unknown;
  /** Server message already localized for the active language; shown only when present. */
  serverMessage?: string;
}

/** The only error type the UI layers handle. Library/transport errors are converted by `normalizeError`. */
export class AppError extends Error {
  readonly kind: ErrorKind;
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly details: readonly FieldIssue[];
  readonly traceId: string | undefined;
  readonly serverMessage: string | undefined;

  constructor(init: AppErrorInit) {
    super(init.serverMessage ?? `${ERROR_MESSAGE_PREFIX}${init.kind}`, { cause: init.cause });
    this.name = 'AppError';
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? [];
    this.traceId = init.traceId;
    this.serverMessage = init.serverMessage;
  }

  /** i18n key of the message: the specific one for a known server code, else the generic one for the kind. */
  get messageKey(): string {
    return isErrorCode(this.code)
      ? `${ERROR_CODE_MESSAGE_PREFIX}${this.code}`
      : `${ERROR_MESSAGE_PREFIX}${this.kind}`;
  }

  /** Worth showing a "Retry" action: a repeat attempt may succeed. */
  get retryable(): boolean {
    return this.kind === 'network' || this.kind === 'timeout' || this.kind === 'server';
  }
}
