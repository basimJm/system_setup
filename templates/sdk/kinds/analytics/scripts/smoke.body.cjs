/* Consumer scenario run by scripts/package-smoke.cjs through CJS and ESM: the fake sink end to end. */
module.exports = async (lib) => {
  const analytics = lib.createAnalytics({
    environment: 'dev',
    provider: 'fake',
    flushIntervalMs: 0,
  });
  analytics.track({ name: 'app_open', anonymousId: 'anon-1' });
  analytics.linkIdentity({ anonymousId: 'anon-1', userId: 'u1' });
  analytics.track({ name: 'booking_created', userId: 'u1', properties: { amount: 1500 } });
  await analytics.flush();
  let refused = false;
  try {
    lib.createAnalytics({ environment: 'prod', provider: 'fake' });
  } catch (error) {
    refused = lib.isSdkError(error) && error.code === lib.ERROR_CODES.CONFIG_INVALID;
  }
  await analytics.close();
  if (
    analytics.sink.events.length !== 3 ||
    analytics.sink.named('identity_linked').length !== 1 ||
    analytics.pending !== 0 ||
    analytics.dropped !== 0 ||
    !refused ||
    typeof lib.HttpSink !== 'function'
  )
    throw new Error('smoke failed');
};
