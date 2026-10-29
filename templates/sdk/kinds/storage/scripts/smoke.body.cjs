/* Consumer scenario run by scripts/package-smoke.cjs through CJS and ESM: the fake adapter end to end. */
module.exports = async (lib) => {
  const store = lib.createStorage({
    environment: 'dev',
    provider: 'fake',
    cdn: { baseUrl: 'http://localhost:9000/cdn' },
  });
  const request = {
    key: 'smoke/1/a.png',
    visibility: 'PUBLIC',
    contentType: 'image/png',
    maxBytes: 100,
    expiresInSec: 60,
  };
  const target = await store.createUploadUrl(request);
  store.simulateUpload(request.key, Buffer.from('png'));
  const confirmed = await store.confirmUpload(request);
  const url = store.getPublicUrl(request.key);
  await store.delete([request.key]);
  let refused = false;
  try {
    lib.createStorage({
      environment: 'prod',
      provider: 'fake',
      cdn: { baseUrl: 'https://cdn.test' },
    });
  } catch (error) {
    refused = lib.isSdkError(error) && error.code === lib.ERROR_CODES.CONFIG_INVALID;
  }
  if (
    target.method !== 'PUT' ||
    confirmed.status !== 'CONFIRMED' ||
    !url.endsWith('/smoke/1/a.png') ||
    store.calls.length !== 4 ||
    !refused ||
    typeof lib.S3Storage !== 'function'
  )
    throw new Error('smoke failed');
};
