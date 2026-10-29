import type { Endpoint } from '../api/endpoint';
import type { MockAnswer, MockRequest, MockRoute } from './mockTransport';

export interface TypedAnswer<TData> extends Omit<MockAnswer, 'data' | 'empty'> {
  data: TData;
  empty?: TData;
}

/**
 * Builds a mock route from a real endpoint: method and path come from the generated contract and the fixture
 * must have the endpoint's response type, so a contract change breaks the fixture at compile time.
 */
export function mockRoute<TData, TBody, TQuery>(
  endpoint: Endpoint<TData, TBody, TQuery>,
  respond: (request: MockRequest) => TypedAnswer<TData>,
): MockRoute {
  return { method: endpoint.op.method, path: endpoint.op.path, respond };
}
