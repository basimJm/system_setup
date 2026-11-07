import { KERNEL_ERROR_CODES } from '../src/constants/codes';
import { __PROVIDER_CLASS__ } from '../src/adapters/__PROVIDER_ID__';

/*
 * SKELETON, written by SYSTEM_SETUP: the __PROVIDER_ID__ adapter is not implemented yet.
 *
 * Missing:
__MISSING_LINES__
 *
 * `it.failing` keeps the CI green while the call below fails, and turns red the day it passes: then
 * change it to `it`, add the real tests, and delete the "skeleton refuses" test.
 */
describe('__PROVIDER_ID__ adapter (skeleton)', () => {
  it.failing('NOT IMPLEMENTED: __PROVIDER_ID__ must accept a valid call', async () => {
    const adapter = new __PROVIDER_CLASS__();
    await __PORT_CALL__;
  });

  it('skeleton refuses: every method rejects until the adapter is implemented', async () => {
    const adapter = new __PROVIDER_CLASS__();
    expect(adapter.name).toBe('__PROVIDER_ID__');
    const methods = adapter as unknown as Record<string, () => unknown>;
    for (const method of __PORT_METHOD_LIST__)
      await expect(
        Promise.resolve().then(() => methods[method]?.call(adapter)),
      ).rejects.toMatchObject({ code: KERNEL_ERROR_CODES.UNKNOWN });
  });
});
