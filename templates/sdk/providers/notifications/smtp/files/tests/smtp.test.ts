import { ERROR_CODES, SdkError } from '../src';
import {
  SmtpEmailSender,
  normalizeSmtpError,
  type MailMessage,
  type SmtpTransportLike,
} from '../src/adapters/smtp';

const from = { name: 'Sender', address: 'noreply@example.com' };

const transportOf = (
  answer: (message: MailMessage) => Awaited<ReturnType<SmtpTransportLike['sendMail']>> | Error,
  sent: MailMessage[] = [],
  close?: () => void,
): SmtpTransportLike => ({
  sendMail: (message) => {
    sent.push(message);
    const result = answer(message);
    return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
  },
  ...(close === undefined ? {} : { close }),
});

describe('SmtpEmailSender', () => {
  it('sends text and html with reply-to and tags as X- headers', async () => {
    const sent: MailMessage[] = [];
    const sender = new SmtpEmailSender({
      transport: transportOf(
        () => ({ messageId: '<m1>', accepted: ['a@example.com'], rejected: [] }),
        sent,
      ),
      from,
    });
    await expect(
      sender.send({
        to: ['a@example.com'],
        subject: 's',
        text: 't',
        html: '<b>t</b>',
        replyTo: 'r@example.com',
        tags: { campaign: 'c1' },
      }),
    ).resolves.toEqual({ id: '<m1>', status: 'SENT' });
    expect(sent[0]).toEqual({
      from,
      to: ['a@example.com'],
      subject: 's',
      text: 't',
      html: '<b>t</b>',
      replyTo: 'r@example.com',
      headers: { 'X-campaign': 'c1' },
    });
  });

  it('sends a plain message with a custom tag prefix and an empty id when the server gives none', async () => {
    const sent: MailMessage[] = [];
    const sender = new SmtpEmailSender({
      transport: transportOf(() => ({ accepted: ['a@example.com'], rejected: [] }), sent),
      from,
      tagHeaderPrefix: 'Y-',
    });
    await expect(
      sender.send({ to: ['a@example.com'], subject: 's', text: 't', tags: { k: 'v' } }),
    ).resolves.toEqual({ id: '', status: 'SENT' });
    await sender.send({ to: ['a@example.com'], subject: 's', text: 't' });
    expect(sent[0]?.headers).toEqual({ 'Y-k': 'v' });
    expect(sent[1]).toEqual({ from, to: ['a@example.com'], subject: 's', text: 't' });
  });

  it('fails when every recipient is refused and when the transport fails', async () => {
    const refused = new SmtpEmailSender({
      transport: transportOf(() => ({ accepted: [], rejected: ['a@example.com'] })),
      from,
    });
    await expect(
      refused.send({ to: ['a@example.com'], subject: 's', text: 't' }),
    ).rejects.toMatchObject({ code: ERROR_CODES.VENDOR_ERROR });
    const down = new SmtpEmailSender({
      transport: transportOf(() => Object.assign(new Error('x'), { code: 'ECONNREFUSED' })),
      from,
    });
    await expect(
      down.send({ to: ['a@example.com'], subject: 's', text: 't' }),
    ).rejects.toMatchObject({ code: ERROR_CODES.NETWORK_ERROR, retryable: true });
  });

  it('closes the transport when it can be closed', async () => {
    let closed = false;
    await new SmtpEmailSender({
      transport: transportOf(
        () => new Error('unused'),
        [],
        () => {
          closed = true;
        },
      ),
      from,
    }).close();
    await new SmtpEmailSender({ transport: transportOf(() => new Error('unused')), from }).close();
    expect(closed).toBe(true);
  });
});

describe('normalizeSmtpError', () => {
  const of = (code: string, reply?: number): SdkError =>
    normalizeSmtpError({ code, ...(reply === undefined ? {} : { responseCode: reply }) });

  it('maps every class of failure', () => {
    expect(of('EAUTH')).toMatchObject({ code: ERROR_CODES.AUTH_FAILED, retryable: false });
    expect(of('', 535)).toMatchObject({ code: ERROR_CODES.AUTH_FAILED });
    expect(of('ETIMEDOUT')).toMatchObject({ code: ERROR_CODES.TIMEOUT, retryable: true });
    expect(of('ENOTFOUND')).toMatchObject({ code: ERROR_CODES.NETWORK_ERROR, retryable: true });
    expect(of('EENVELOPE', 550)).toMatchObject({
      code: ERROR_CODES.VENDOR_ERROR,
      retryable: false,
    });
    expect(of('', 451)).toMatchObject({ code: ERROR_CODES.UNAVAILABLE, retryable: true });
    expect(of('weird')).toMatchObject({ code: ERROR_CODES.UNKNOWN });
    expect(normalizeSmtpError('text')).toMatchObject({ code: ERROR_CODES.UNKNOWN });
  });

  it('keeps an SdkError as it is', () => {
    const typed = new SdkError(ERROR_CODES.TIMEOUT, 'late');
    expect(normalizeSmtpError(typed)).toBe(typed);
  });
});
