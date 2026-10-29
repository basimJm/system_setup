import { ERROR_CODES, SDK_NAME } from '../src';

describe('scaffold', () => {
  it('exports the SDK name and prefixed codes', () => {
    expect(SDK_NAME).toBe('__SYSTEM_SLUG__-__SDK_KIND__');
    expect(ERROR_CODES.SINK_FAILED).toBe('__SDK_PREFIX___SINK_FAILED');
  });
});
