/* Consumer scenario run by scripts/package-smoke.cjs through CJS and ESM: the fake gateway end to end. */
module.exports = async (lib) => {
  const gateway = lib.createPayments({
    environment: 'dev',
    provider: 'fake',
    webhookSecret: 'smoke-secret-0123456789',
  });
  const session = await gateway.createSession({
    orderId: 'order-1',
    amount: 1000,
    currency: 'JOD',
    customer: { id: 'c1' },
    returnUrl: 'https://app.example.test/return',
    idempotencyKey: 'k1',
  });
  const webhook = gateway.settle(session.sessionId, 'PAID');
  const event = await gateway.parseWebhook({ headers: webhook.headers, rawBody: webhook.body });
  const state = await gateway.verify(session.sessionId);
  const refund = await gateway.refund({
    sessionId: session.sessionId,
    reason: 'smoke',
    idempotencyKey: 'r1',
  });
  let refused = false;
  try {
    lib.createPayments({
      environment: 'prod',
      provider: 'fake',
      webhookSecret: 'smoke-secret-0123456789',
    });
  } catch (error) {
    refused = lib.isSdkError(error) && error.code === lib.ERROR_CODES.CONFIG_INVALID;
  }
  await gateway.close();
  if (
    session.status !== 'PENDING' ||
    event.type !== 'PAYMENT_PAID' ||
    state.status !== 'PAID' ||
    refund.amount !== 1000 ||
    !refused ||
    typeof lib.startMockGateway !== 'function'
  )
    throw new Error('smoke failed');
};
