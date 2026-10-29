import type { FetchLike } from '../../src/config/options';

type Response = Awaited<ReturnType<FetchLike>>;

export interface StoredObject {
  readonly body: Buffer;
  readonly contentType: string;
}

export interface Request {
  readonly method: string;
  readonly url: string;
  readonly headers: Record<string, string>;
}

const headersOf = (map: Record<string, string>): Response['headers'] => ({
  get: (name) => map[name.toLowerCase()] ?? null,
});

const response = (
  status: number,
  headers: Record<string, string> = {},
  body?: Buffer,
): Response => ({
  status,
  headers: headersOf(headers),
  arrayBuffer: () => Promise.resolve(Uint8Array.from(body ?? []).buffer),
});

/**
 * S3 wire emulator behind `FetchLike`: objects keyed by `host + path`, every signed request
 * recorded, failures injectable (`nextStatus`, `failNext`). No sockets, so it runs anywhere.
 */
export class MiniS3 {
  readonly objects = new Map<string, StoredObject>();
  readonly requests: Request[] = [];
  /** Statuses returned (one per call) before normal handling resumes. */
  readonly nextStatus: number[] = [];
  /** Rejections thrown (one per call) before normal handling resumes. */
  readonly failNext: Error[] = [];

  readonly fetch: FetchLike = (url, init) => {
    this.requests.push({ method: init.method, url, headers: init.headers });
    const failure = this.failNext.shift();
    if (failure) return Promise.reject(failure);
    const forced = this.nextStatus.shift();
    if (forced !== undefined) return Promise.resolve(response(forced));
    if (!init.headers.Authorization) return Promise.resolve(response(403));
    const key = MiniS3.keyOf(url);
    const stored = this.objects.get(key);
    switch (init.method) {
      case 'PUT':
        this.objects.set(key, {
          body: Buffer.from(init.body ?? new Uint8Array()),
          contentType: init.headers['content-type'] ?? '',
        });
        return Promise.resolve(response(200));
      case 'HEAD':
        return Promise.resolve(
          stored
            ? response(200, {
                'content-length': String(stored.body.length),
                'content-type': stored.contentType,
              })
            : response(404),
        );
      case 'GET':
        return Promise.resolve(
          stored
            ? response(
                200,
                {
                  'content-length': String(stored.body.length),
                  'content-type': stored.contentType,
                },
                stored.body,
              )
            : response(404),
        );
      case 'DELETE':
        this.objects.delete(key);
        return Promise.resolve(response(stored ? 204 : 404));
      default:
        return Promise.resolve(response(400));
    }
  };

  static keyOf(url: string): string {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  }

  /** Simulates the client's PUT to a presigned URL (unsigned header-wise, query-signed). */
  put(presignedUrl: string, body: Buffer, contentType: string): void {
    this.objects.set(MiniS3.keyOf(presignedUrl), { body, contentType });
  }

  get size(): number {
    return this.objects.size;
  }
}
