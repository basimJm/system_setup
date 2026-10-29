import { createPayments } from '../src/payments';
import { startMockGateway } from '../src/mock/server';
import { API_KEY, SECRET, sessionRequest } from './helpers/fixtures';

const HOST = '127.0.0.1';

describe('startMockGateway', () => {
  it('serves the protocol over real HTTP to the http adapter', async () => {
    const mock = await startMockGateway(
      {
        apiKey: API_KEY,
        webhookSecret: SECRET,
        sessionTtlSec: 60,
        checkoutUrl: 'http://localhost/pay',
        now: () => new Date(),
      },
      { port: 0, host: HOST },
    );
    try {
      expect(mock.url).toBe(`http://${HOST}:${String(mock.port)}`);
      const gateway = createPayments({
        environment: 'dev',
        provider: 'http',
        webhookSecret: SECRET,
        http: { baseUrl: mock.url, apiKey: API_KEY },
        retry: { maxAttempts: 1 },
      });
      const session = await gateway.createSession(sessionRequest());
      const settled = await fetch(`${mock.url}/v1/sessions/${session.sessionId}/settle`, {
        method: 'POST',
        headers: { authorization: `Bearer ${API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'PAID' }),
      });
      const { webhook } = (await settled.json()) as {
        webhook: { headers: Record<string, string>; body: string };
      };
      await expect(
        gateway.parseWebhook({ headers: webhook.headers, rawBody: webhook.body }),
      ).resolves.toMatchObject({ type: 'PAYMENT_PAID' });
      await expect(gateway.verify(session.sessionId)).resolves.toMatchObject({ status: 'PAID' });
      const missing = await fetch(`${mock.url}/v1/none`, {
        headers: { authorization: `Bearer ${API_KEY}` },
      });
      expect(missing.status).toBe(404);
    } finally {
      await mock.close();
    }
  });

  it('rejects when the port is taken', async () => {
    const first = await startMockGateway(
      {
        apiKey: API_KEY,
        webhookSecret: SECRET,
        sessionTtlSec: 60,
        checkoutUrl: 'http://localhost/pay',
        now: () => new Date(),
      },
      { port: 0, host: HOST },
    );
    try {
      await expect(
        startMockGateway(
          {
            apiKey: API_KEY,
            webhookSecret: SECRET,
            sessionTtlSec: 60,
            checkoutUrl: 'http://localhost/pay',
            now: () => new Date(),
          },
          { port: first.port, host: HOST },
        ),
      ).rejects.toThrow();
    } finally {
      await first.close();
    }
    await expect(first.close()).rejects.toThrow();
  });
});
