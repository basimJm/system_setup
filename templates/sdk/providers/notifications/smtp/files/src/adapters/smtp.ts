import { KERNEL_ERROR_CODES } from '../constants/codes';
import type { EmailStatus } from '../constants/notifications';
import { SdkError } from '../errors';
import type { EmailMessage, EmailSender } from '../types';

export interface MailMessage {
  readonly from: { readonly name: string; readonly address: string };
  readonly to: readonly string[];
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
  readonly replyTo?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

/** The slice of a nodemailer transport used here (injectable for tests and other mailers). */
export interface SmtpTransportLike {
  sendMail(message: MailMessage): Promise<{
    readonly messageId?: string;
    readonly accepted: readonly unknown[];
    readonly rejected: readonly unknown[];
  }>;
  close?(): void;
}

export interface SmtpSenderOptions {
  readonly transport: SmtpTransportLike;
  readonly from: { readonly name: string; readonly address: string };
  /** Prefix of the vendor tags sent as `X-` headers. */
  readonly tagHeaderPrefix?: string;
}

const SMTP_CODES = {
  auth: ['EAUTH', 'ENOAUTH'],
  timeout: ['ETIMEDOUT', 'ESOCKETTIMEDOUT'],
  network: ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'ESOCKET', 'ECONNECTION'],
  authReply: 535,
  transientFrom: 400,
  permanentFrom: 500,
  defaultTagPrefix: 'X-',
} as const;

const has = (list: readonly string[], code: string): boolean => list.includes(code);

const shape = (error: unknown): { code: string; reply: number | undefined } => {
  const record = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : {};
  return {
    code: typeof record['code'] === 'string' ? record['code'] : '',
    reply: typeof record['responseCode'] === 'number' ? record['responseCode'] : undefined,
  };
};

/** Turns a nodemailer error into the SDK's typed error. */
export const normalizeSmtpError = (error: unknown): SdkError => {
  if (error instanceof SdkError) return error;
  const { code, reply } = shape(error);
  const base = { cause: error, details: { smtpCode: code, replyCode: reply ?? null } };
  if (has(SMTP_CODES.auth, code) || reply === SMTP_CODES.authReply)
    return new SdkError(KERNEL_ERROR_CODES.AUTH_FAILED, 'SMTP rejected the credentials', base);
  if (has(SMTP_CODES.timeout, code))
    return new SdkError(KERNEL_ERROR_CODES.TIMEOUT, 'SMTP request timed out', { ...base, retryable: true });
  if (has(SMTP_CODES.network, code))
    return new SdkError(KERNEL_ERROR_CODES.NETWORK_ERROR, 'SMTP server unreachable', { ...base, retryable: true });
  if (reply !== undefined && reply >= SMTP_CODES.permanentFrom)
    return new SdkError(KERNEL_ERROR_CODES.VENDOR_ERROR, 'SMTP permanent failure', base);
  if (reply !== undefined && reply >= SMTP_CODES.transientFrom)
    return new SdkError(KERNEL_ERROR_CODES.UNAVAILABLE, 'SMTP temporary failure', { ...base, retryable: true });
  return new SdkError(KERNEL_ERROR_CODES.UNKNOWN, 'unexpected SMTP error', base);
};

/** E-mail through any SMTP server. Retries belong to the notifier, which retries only retryable errors. */
export class SmtpEmailSender implements EmailSender {
  readonly name = 'smtp';

  constructor(private readonly options: SmtpSenderOptions) {}

  async send(message: EmailMessage): Promise<{ readonly id: string; readonly status: EmailStatus }> {
    const prefix = this.options.tagHeaderPrefix ?? SMTP_CODES.defaultTagPrefix;
    const headers = Object.fromEntries(
      Object.entries(message.tags ?? {}).map(([key, value]) => [`${prefix}${key}`, value]),
    );
    let info: Awaited<ReturnType<SmtpTransportLike['sendMail']>>;
    try {
      info = await this.options.transport.sendMail({
        from: this.options.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.html === undefined ? {} : { html: message.html }),
        ...(message.replyTo === undefined ? {} : { replyTo: message.replyTo }),
        ...(Object.keys(headers).length === 0 ? {} : { headers }),
      });
    } catch (error) {
      throw normalizeSmtpError(error);
    }
    if (info.accepted.length === 0)
      throw new SdkError(KERNEL_ERROR_CODES.VENDOR_ERROR, 'SMTP refused every recipient', {
        details: { rejected: info.rejected.length },
      });
    return { id: info.messageId ?? '', status: 'SENT' };
  }

  close(): Promise<void> {
    this.options.transport.close?.();
    return Promise.resolve();
  }
}
