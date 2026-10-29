import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from 'vite';
import { PUBLIC_ENV_PREFIX } from '../src/constants/env.ts';
import { resolveVariant } from '../src/infrastructure/config/variant.ts';
import { buildEnv, hostingFiles, originsFromEnv, type HostingTarget } from './lib/hosting.ts';

/**
 * node scripts/write-hosting.ts <variant> [--target netlify|cloudflare|vercel] [--out <dir>]
 * Writes the host's header and routing files from the same public env values the build used
 * (VITE_API_BASE_URL, VITE_SOCKET_URL from the environment or the variant's `.env.<dev|prod>` file; optional
 * CSP_CONNECT_EXTRA = comma list of extra https origins).
 */
const args = process.argv.slice(2);
const variant = args[0];
const option = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!variant) {
  console.error('usage: write-hosting.ts <variant> [--target netlify|vercel] [--out <dir>]');
  process.exit(1);
}
const TARGETS: readonly HostingTarget[] = ['netlify', 'cloudflare', 'vercel'];
const target: HostingTarget = TARGETS.find((t) => t === option('--target')) ?? 'netlify';
const out = option('--out') ?? join('dist', variant);
const requireRemote = variant.startsWith('prod');
const fileEnv = loadEnv(resolveVariant(variant).appEnv, process.cwd(), PUBLIC_ENV_PREFIX);
const files = hostingFiles(target, originsFromEnv(buildEnv(process.env, fileEnv), requireRemote));
mkdirSync(out, { recursive: true });
for (const [name, content] of Object.entries(files)) writeFileSync(join(out, name), content);
console.log(`hosting: wrote ${Object.keys(files).join(', ')} for ${target} into ${out}`);
