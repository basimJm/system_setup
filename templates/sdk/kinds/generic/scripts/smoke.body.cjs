/* Consumer scenario run by scripts/package-smoke.cjs through CJS and ESM: the fake provider end to end. */
module.exports = async (lib) => {
  const client = lib.create__SDK_TITLE__({ environment: 'dev', provider: 'fake' });
  const result = await client.execute({ operation: 'ping', payload: { n: 1 } });
  let refused = false;
  try {
    lib.create__SDK_TITLE__({ environment: 'prod', provider: 'fake' });
  } catch (error) {
    refused = lib.isSdkError(error) && error.code === lib.ERROR_CODES.CONFIG_INVALID;
  }
  await client.close();
  if (result.status !== 'DONE' || !refused || typeof lib.Fake__SDK_TITLE__Port !== 'function')
    throw new Error('smoke failed');
};
