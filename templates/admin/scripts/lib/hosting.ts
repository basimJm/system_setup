/** Security headers and routing a static host must serve for the admin panel (Admin Tasks ADM-006). */

/** Cloudflare Pages reads the same `_headers` and `_redirects` files as Netlify. */
export type HostingTarget = 'netlify' | 'cloudflare' | 'vercel';

export interface HostingOrigins {
  /** Base URL of the API (`https://…`); empty for a mock-only dev build. */
  readonly api: string;
  /** Origin of the Socket.IO server; empty for a mock-only dev build. */
  readonly socket: string;
  /** Extra https origins the browser may call (the storage host a presigned upload goes to). */
  readonly extraConnect: readonly string[];
}

export type HeaderList = readonly (readonly [name: string, value: string])[];

export interface HeaderRule {
  readonly path: string;
  readonly headers: HeaderList;
}

const HTTPS = 'https:';
const WSS = 'wss:';
const HSTS_SECONDS = 63_072_000;
const ASSET_CACHE_SECONDS = 31_536_000;
const SELF = "'self'";
const NONE = "'none'";

/** `https://api.example.com/v1` -> `https://api.example.com`; throws for anything that is not https. */
export function httpsOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== HTTPS) throw new Error(`not an https URL: ${url.protocol}//${url.host}`);
  return url.origin;
}

const wsOrigin = (origin: string): string => origin.replace(/^https:/, WSS);

/** Origins the page may connect to: itself, the API, the socket server (https and wss) and the extras. */
export function connectSources(o: HostingOrigins): string[] {
  const origins = [o.api, o.socket, ...o.extraConnect].filter((v) => v !== '').map(httpsOrigin);
  const sockets = o.socket === '' ? [] : [wsOrigin(httpsOrigin(o.socket))];
  return [...new Set([SELF, ...origins, ...sockets])];
}

/** The content security policy: nothing but this site's files, plus the origins the app talks to. */
export function buildCsp(o: HostingOrigins): string {
  const directives: Record<string, readonly string[]> = {
    'default-src': [SELF],
    'script-src': [SELF],
    'style-src': [SELF],
    'style-src-attr': ["'unsafe-inline'"],
    'img-src': [SELF, 'data:', 'blob:', 'https:'],
    'media-src': [SELF, 'blob:', 'https:'],
    // The build inlines small fonts as data: URIs.
    'font-src': [SELF, 'data:'],
    'connect-src': connectSources(o),
    'frame-src': [NONE],
    'frame-ancestors': [NONE],
    'object-src': [NONE],
    'base-uri': [SELF],
    'form-action': [SELF],
  };
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ');
}

/** Headers for every response. */
export function securityHeaders(o: HostingOrigins): HeaderList {
  return [
    ['Content-Security-Policy', buildCsp(o)],
    ['Strict-Transport-Security', `max-age=${String(HSTS_SECONDS)}; includeSubDomains`],
    ['X-Content-Type-Options', 'nosniff'],
    ['X-Frame-Options', 'DENY'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()'],
    ['Cross-Origin-Opener-Policy', 'same-origin'],
  ];
}

/** Hashed build files never change; the page itself must always be revalidated. */
export const CACHE_RULES: readonly HeaderRule[] = [
  {
    path: '/assets/*',
    headers: [['Cache-Control', `public, max-age=${String(ASSET_CACHE_SECONDS)}, immutable`]],
  },
  { path: '/index.html', headers: [['Cache-Control', 'no-cache']] },
];

export function headerRules(o: HostingOrigins): readonly HeaderRule[] {
  return [{ path: '/*', headers: securityHeaders(o) }, ...CACHE_RULES];
}

/** Netlify `_headers`. */
export function netlifyHeaders(o: HostingOrigins): string {
  return headerRules(o)
    .map((r) => `${r.path}\n${r.headers.map(([k, v]) => `  ${k}: ${v}`).join('\n')}`)
    .join('\n\n')
    .concat('\n');
}

/** Netlify `_redirects`: every path is served by the single-page app. */
export const NETLIFY_REDIRECTS = '/*  /index.html  200\n';

/** Vercel `vercel.json`. */
export function vercelConfig(o: HostingOrigins): string {
  const headers = headerRules(o).map((r) => ({
    source: r.path.replace('/*', '/(.*)'),
    headers: r.headers.map(([key, value]) => ({ key, value })),
  }));
  return `${JSON.stringify({ rewrites: [{ source: '/(.*)', destination: '/index.html' }], headers }, null, 2)}\n`;
}

/** Files to write for a target: path (relative to the output folder) and content. */
export function hostingFiles(target: HostingTarget, o: HostingOrigins): Record<string, string> {
  return target === 'netlify' || target === 'cloudflare'
    ? { _headers: netlifyHeaders(o), _redirects: NETLIFY_REDIRECTS }
    : { 'vercel.json': vercelConfig(o) };
}

/** Origins from environment values; prod builds must name the API and the socket server. */
export function originsFromEnv(
  env: Readonly<Record<string, string | undefined>>,
  requireRemote: boolean,
): HostingOrigins {
  const api = env['VITE_API_BASE_URL'] ?? '';
  const socket = env['VITE_SOCKET_URL'] ?? '';
  if (requireRemote && (api === '' || socket === '')) {
    throw new Error('VITE_API_BASE_URL and VITE_SOCKET_URL are required for a prod build');
  }
  const extra = (env['CSP_CONNECT_EXTRA'] ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v !== '');
  return { api, socket, extraConnect: extra };
}

/**
 * The values the build used: real environment variables win over the variant's `.env.<dev|prod>` file (same rule as
 * `vite.config.ts`). Without the file, a host that sets no variables got `connect-src 'self'` and blocked the API.
 */
export function buildEnv(
  processEnv: Readonly<Record<string, string | undefined>>,
  fileEnv: Readonly<Record<string, string>>,
): Record<string, string | undefined> {
  const merged: Record<string, string | undefined> = { ...fileEnv };
  for (const [key, value] of Object.entries(processEnv)) {
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}
