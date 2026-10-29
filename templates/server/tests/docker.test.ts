import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const root = join(__dirname, '..');
const read = (file: string): string => readFileSync(join(root, file), 'utf8');

interface ComposeService {
  ports?: string[];
  environment?: Record<string, string>;
  profiles?: string[];
  depends_on?: Record<string, { condition: string }>;
  healthcheck?: unknown;
}
interface Compose {
  services: Record<string, ComposeService>;
  volumes: Record<string, unknown>;
}

const compose = parse(read('docker-compose.yml')) as Compose;

describe('docker-compose.yml', () => {
  it('defines the local infrastructure and the optional API behind the "app" profile', () => {
    expect(Object.keys(compose.services).sort()).toEqual(['api', 'mongo', 'redis']);
    expect(compose.services['api']?.profiles).toEqual(['app']);
  });

  it('binds every published port to localhost only and persists data in named volumes', () => {
    for (const service of Object.values(compose.services))
      for (const port of service.ports ?? []) expect(port.startsWith('127.0.0.1:')).toBe(true);
    expect(Object.keys(compose.volumes).sort()).toEqual(['mongo-data', 'redis-data']);
  });

  it('runs MongoDB as a replica set and waits for health before the API starts', () => {
    expect(read('docker-compose.yml')).toContain('--replSet');
    const dependsOn = compose.services['api']?.depends_on ?? {};
    expect(dependsOn['mongo']?.condition).toBe('service_healthy');
    expect(dependsOn['redis']?.condition).toBe('service_healthy');
  });

  it('never writes credentials into the files', () => {
    for (const file of ['docker-compose.yml', 'docker-compose.deploy.yml']) {
      const withoutReferences = read(file).replace(/\$\{[^}]*\}/g, '');
      expect(withoutReferences).not.toMatch(/(password|secret|token)[ \t]*[:=][ \t]*[^\s"'{]/i);
    }
  });

  it('documents every compose variable in docker/compose.env.example, values empty', () => {
    const used = new Set(
      [...read('docker-compose.yml').matchAll(/\$\{([A-Z_]+)[:}?-]/g)].map((m) => m[1] ?? ''),
    );
    const lines = read('docker/compose.env.example')
      .split('\n')
      .filter((line) => /^[A-Z_]+=/.test(line));
    expect([...used].sort()).toEqual(lines.map((line) => line.split('=')[0] ?? '').sort());
    for (const line of lines) expect(line.endsWith('=')).toBe(true);
  });
});

describe('Dockerfile', () => {
  const dockerfile = read('Dockerfile');

  it('uses a multi-stage Node 22 build with reproducible, production-only runtime dependencies', () => {
    expect(dockerfile.match(/^FROM node:22-alpine/gm)).toHaveLength(2);
    expect(dockerfile).toContain('npm ci\n');
    expect(dockerfile).toContain('npm ci --omit=dev');
    expect(dockerfile).toContain('ENV NODE_ENV=production');
  });

  it('runs unprivileged with a healthcheck on /health and copies no environment files', () => {
    expect(dockerfile).toMatch(/^USER node$/m);
    expect(dockerfile).toContain('/health');
    expect(dockerfile).toContain('CMD ["node", "dist/server.js"]');
    expect(dockerfile).not.toMatch(/COPY[^\n]*\.env/);
    for (const entry of ['.env', '.env.*', 'node_modules', 'dist'])
      expect(read('.dockerignore').split('\n')).toContain(entry);
  });
});
