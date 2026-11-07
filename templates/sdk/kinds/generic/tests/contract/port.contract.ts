import { RESULT_STATUSES } from '../../src/constants/sdk';
import type { __SDK_TITLE__Port } from '../../src/types';

/**
 * The contract every adapter of the port must honour. Run it against the fake here and against each
 * real adapter in its own test; it throws (so it works inside `it`, and inside `it.failing`).
 */
export const assertPortContract = async (port: __SDK_TITLE__Port): Promise<void> => {
  if (port.name.trim() === '') throw new Error('the adapter needs a name');
  const result = await port.execute({ operation: 'ping', payload: { attempt: 1 } });
  if (result.id.trim() === '') throw new Error('the result needs an id');
  if (!RESULT_STATUSES.includes(result.status)) throw new Error('the result needs a known status');
  await port.close?.();
};
