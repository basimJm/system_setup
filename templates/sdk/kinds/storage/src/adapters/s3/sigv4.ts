import { createHash, createHmac } from 'node:crypto';
import { HEADERS, S3 } from '../../constants/storage';

export interface SigV4Credentials {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly sessionToken?: string | undefined;
}

export interface SigV4Scope {
  readonly region: string;
  readonly credentials: SigV4Credentials;
  readonly now: () => Date;
}

const sha256Hex = (data: Uint8Array | string): string =>
  createHash('sha256').update(data).digest('hex');
const hmac = (key: Buffer | string, data: string): Buffer =>
  createHmac('sha256', key).update(data).digest();

/** RFC 3986 encoding as SigV4 wants it (`encodeURIComponent` plus `!'()*`). */
export const encodeRfc3986 = (value: string): string =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/** `20261028T101500Z` */
export const amzDate = (date: Date): string =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

const canonicalQuery = (params: readonly (readonly [string, string])[]): string =>
  params
    .map(([k, v]) => [encodeRfc3986(k), encodeRfc3986(v)] as const)
    .sort((a, b) => (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

const canonicalPath = (pathname: string): string =>
  pathname.split('/').map(encodeRfc3986).join('/');

const signingKey = (secret: string, day: string, region: string): Buffer =>
  hmac(hmac(hmac(hmac(`AWS4${secret}`, day), region), S3.service), S3.requestScope);

const signature = (
  scope: SigV4Scope,
  stamp: string,
  canonicalRequest: string,
): { readonly signature: string; readonly credential: string } => {
  const day = stamp.slice(0, 8);
  const credentialScope = `${day}/${scope.region}/${S3.service}/${S3.requestScope}`;
  const toSign = `${S3.algorithm}\n${stamp}\n${credentialScope}\n${sha256Hex(canonicalRequest)}`;
  const key = signingKey(scope.credentials.secretAccessKey, day, scope.region);
  return {
    signature: hmac(key, toSign).toString('hex'),
    credential: `${scope.credentials.accessKeyId}/${credentialScope}`,
  };
};

export interface PresignRequest {
  readonly method: string;
  /** Scheme, host and path of the object; the query is replaced. */
  readonly url: URL;
  readonly expiresInSec: number;
}

/** Query-string presigned URL (upload PUT, private GET); the payload stays unsigned. */
export const presignUrl = (scope: SigV4Scope, request: PresignRequest): string => {
  const stamp = amzDate(scope.now());
  const day = stamp.slice(0, 8);
  const params: (readonly [string, string])[] = [
    [S3.query.algorithm, S3.algorithm],
    [
      S3.query.credential,
      `${scope.credentials.accessKeyId}/${day}/${scope.region}/${S3.service}/${S3.requestScope}`,
    ],
    [S3.query.date, stamp],
    [S3.query.expires, String(request.expiresInSec)],
    [S3.query.signedHeaders, HEADERS.host],
  ];
  if (scope.credentials.sessionToken !== undefined)
    params.push([S3.query.securityToken, scope.credentials.sessionToken]);
  const query = canonicalQuery(params);
  const canonicalRequest = [
    request.method,
    canonicalPath(request.url.pathname),
    query,
    `${HEADERS.host}:${request.url.host}\n`,
    HEADERS.host,
    S3.unsignedPayload,
  ].join('\n');
  const signed = signature(scope, stamp, canonicalRequest);
  const sig = `${encodeRfc3986(S3.query.signature)}=${signed.signature}`;
  return `${request.url.origin}${canonicalPath(request.url.pathname)}?${query}&${sig}`;
};

export interface SignHeadersRequest {
  readonly method: string;
  readonly url: URL;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: Uint8Array | undefined;
}

/** Header-signed request (HEAD / GET / PUT / DELETE from the server itself). */
export const signHeaders = (
  scope: SigV4Scope,
  request: SignHeadersRequest,
): Record<string, string> => {
  const stamp = amzDate(scope.now());
  const payloadHash = request.body ? sha256Hex(request.body) : S3.emptyPayloadSha256;
  const headers: Record<string, string> = {
    ...Object.fromEntries(Object.entries(request.headers).map(([k, v]) => [k.toLowerCase(), v])),
    [HEADERS.host]: request.url.host,
    [HEADERS.amzContentSha256]: payloadHash,
    [HEADERS.amzDate]: stamp,
  };
  if (scope.credentials.sessionToken !== undefined)
    headers[HEADERS.amzSecurityToken] = scope.credentials.sessionToken;
  const entries = Object.entries(headers).sort(([a], [b]) => (a < b ? -1 : 1));
  const names = entries.map(([name]) => name);
  const canonicalHeaders = entries.map(([n, v]) => `${n}:${v.trim()}\n`).join('');
  const canonicalRequest = [
    request.method,
    canonicalPath(request.url.pathname),
    canonicalQuery([...request.url.searchParams.entries()]),
    canonicalHeaders,
    names.join(';'),
    payloadHash,
  ].join('\n');
  const signed = signature(scope, stamp, canonicalRequest);
  headers[HEADERS.authorization] =
    `${S3.algorithm} Credential=${signed.credential}, ` +
    `SignedHeaders=${names.join(';')}, Signature=${signed.signature}`;
  return headers;
};
