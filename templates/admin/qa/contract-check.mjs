/**
 * Every readable admin operation against a LOCAL server, parsed with the generated zod schemas: a `BAD` line means the
 * server answers differently from the OpenAPI the panel was generated from (run `npm run api:sync` first).
 * Usage: node qa/contract-check.mjs   (writes qa-contract.txt)
 */
import { adminToken, BASE } from './lib.mjs';
import { writeFileSync } from 'node:fs';
const ROOT = new URL('../src/data/contract/generated', import.meta.url).pathname;
const dto = await import(`${ROOT}/dto.ts`);
const { OPERATIONS } = await import(`${ROOT}/operations.ts`);
const token = await adminToken();
const out = [];
const get = async (path, query = '') => {
  const res = await fetch(`${BASE}${path}${query}`, {
    headers: { authorization: `Bearer ${token}`, 'accept-language': 'en' },
  });
  let json;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
};
const q = (op) => (op.hasQuery ? '?page=1&pageSize=25' : '');
/** Operations whose query needs more than paging: add the sample query here. */
const NEED = {};
const ops = Object.values(OPERATIONS).filter((o) => o.method === 'get');
for (const op of ops) {
  let path = op.path;
  const params = [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  if (params.length) {
    // `GET /x/{id}`: take the first record of `GET /x`.
    const base = path.slice(0, path.indexOf('{')).replace(/\/$/, '');
    const list = await get(base, '?page=1&pageSize=1');
    const first = Array.isArray(list.json?.data) ? list.json.data[0] : null;
    if (!first?.id) {
      out.push(`SKIP ${op.id} (no sample for ${base})`);
      continue;
    }
    path = path.replace('{id}', first.id);
    if (/\{\w+\}/.test(path)) {
      out.push(`SKIP ${op.id} (params ${params.join(',')})`);
      continue;
    }
  }
  const res = await get(path, NEED[op.id] ?? q(op));
  const schemaFn = dto[`${op.id}DataSchema`];
  if (!schemaFn) {
    out.push(`NOSCHEMA ${op.id}`);
    continue;
  }
  if (res.status !== 200) {
    out.push(`STATUS ${res.status} ${op.id} ${JSON.stringify(res.json?.error)?.slice(0, 120)}`);
    continue;
  }
  const parsed = schemaFn().safeParse(res.json.data);
  out.push(
    parsed.success
      ? `OK   ${op.id}`
      : `BAD  ${op.id}: ${JSON.stringify(parsed.error.issues.slice(0, 3).map((i) => i.path.join('.') + ' ' + i.code + ' ' + i.message))}`,
  );
}
writeFileSync(process.env.QA_REPORT ?? 'qa-contract.txt', out.join('\n') + '\n');
console.log('CONTRACT-DONE', out.filter((l) => l.startsWith('BAD')).length, 'bad');
