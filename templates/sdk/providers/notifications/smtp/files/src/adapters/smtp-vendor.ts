import nodemailer from 'nodemailer';
import type { SmtpTransportLike } from './smtp';

/* istanbul ignore file -- thin glue over nodemailer; proven by a real send, not by unit tests. */

export interface SmtpConnection {
  readonly host: string;
  readonly port?: number;
  readonly user?: string;
  readonly pass?: string;
  readonly timeoutMs?: number;
}

const DEFAULT_PORT = 587;
const IMPLICIT_TLS_PORT = 465;
const DEFAULT_TIMEOUT_MS = 10_000;

/** A pooled nodemailer transport: STARTTLS is required, TLS is implicit on port 465. */
export const createSmtpTransport = (connection: SmtpConnection): SmtpTransportLike => {
  const port = connection.port ?? DEFAULT_PORT;
  const timeout = connection.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return nodemailer.createTransport({
    host: connection.host,
    port,
    secure: port === IMPLICIT_TLS_PORT,
    requireTLS: port !== IMPLICIT_TLS_PORT,
    pool: true,
    connectionTimeout: timeout,
    greetingTimeout: timeout,
    socketTimeout: timeout,
    ...(connection.user !== undefined && connection.pass !== undefined
      ? { auth: { user: connection.user, pass: connection.pass } }
      : {}),
  }) as unknown as SmtpTransportLike;
};
