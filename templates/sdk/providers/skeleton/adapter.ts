import { KERNEL_ERROR_CODES } from '../constants/codes';
import { SdkError } from '../errors';
import type { __PORT_INTERFACE__ } from '../types';

const notImplemented = (): SdkError =>
  new SdkError(KERNEL_ERROR_CODES.UNKNOWN, '__PROVIDER_ID__ adapter is not implemented yet');

/**
 * __PROVIDER_TITLE__ adapter: a skeleton written by SYSTEM_SETUP because no ready adapter exists.
 * It implements the port and rejects every call until the real adapter replaces it.
 * Missing: __MISSING_INLINE__.
 */
export class __PROVIDER_CLASS__ implements __PORT_INTERFACE__ {
  readonly name = '__PROVIDER_ID__';

__PORT_METHODS__
}
