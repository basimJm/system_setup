/* Consumer scenario run by scripts/package-smoke.cjs through CJS and ESM: fake push + email end to end. */
module.exports = async (lib) => {
  const notifier = lib.createNotifications({
    environment: 'dev',
    push: { provider: 'fake' },
    email: { provider: 'fake' },
  });
  notifier.pushSender.invalid.add('gone');
  const push = await notifier.sendPush(
    { tokens: ['t1', 'gone'], title: 'Hi', body: 'There' },
    { idempotencyKey: 'p1' },
  );
  const again = await notifier.sendPush(
    { tokens: ['t1'], body: 'There' },
    { idempotencyKey: 'p1' },
  );
  const mail = await notifier.sendEmail({ to: ['a@example.test'], subject: 'Hello', text: 'Body' });
  let refused = false;
  try {
    lib.createNotifications({ environment: 'prod', push: { provider: 'fake' } });
  } catch (error) {
    refused = lib.isSdkError(error) && error.code === lib.ERROR_CODES.CONFIG_INVALID;
  }
  await notifier.close();
  if (
    push.sent !== 1 ||
    push.invalidTokens.join() !== 'gone' ||
    again.duplicate !== true ||
    mail.status !== 'SENT' ||
    !refused ||
    typeof lib.MemoryIdempotencyStore !== 'function'
  )
    throw new Error('smoke failed');
};
