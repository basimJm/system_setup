import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { WIRE } from '../constants/payments';
import { MockGateway, type MockGatewayOptions } from './gateway';

export interface MockServer {
  readonly gateway: MockGateway;
  /** `http://127.0.0.1:<port>`; append `/v1/...`. */
  readonly url: string;
  readonly port: number;
  close(): Promise<void>;
}

export interface ListenOptions {
  /** 0 = any free port. */
  readonly port: number;
  readonly host: string;
}

const readBody = (request: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    request.on('error', reject);
  });

/** node:http wrapper around `MockGateway.handle` for a dev stack on localhost (never production). */
export const createMockServer = (gateway: MockGateway): Server =>
  createServer((request: IncomingMessage, response: ServerResponse) => {
    void readBody(request).then((body) => {
      const answer = gateway.handle({
        method: request.method ?? 'GET',
        url: request.url ?? '/',
        headers: request.headers,
        body,
      });
      response.writeHead(answer.status, { [WIRE.headers.contentType]: WIRE.json });
      response.end(JSON.stringify(answer.body));
    });
  });

/** Starts the mock gateway; returns its URL and a `close()`. */
export const startMockGateway = (
  options: MockGatewayOptions,
  listen: ListenOptions,
): Promise<MockServer> =>
  new Promise((resolve, reject) => {
    const gateway = new MockGateway(options);
    const server = createMockServer(gateway);
    server.once('error', reject);
    server.listen(listen.port, listen.host, () => {
      const address = server.address();
      /* istanbul ignore next -- a TCP listener always has an address object */
      const port = typeof address === 'object' && address !== null ? address.port : listen.port;
      resolve({
        gateway,
        url: `http://${listen.host}:${String(port)}`,
        port,
        close: () =>
          new Promise<void>((done, fail) => {
            server.close((error) => {
              if (error) fail(error);
              else done();
            });
          }),
      });
    });
  });
