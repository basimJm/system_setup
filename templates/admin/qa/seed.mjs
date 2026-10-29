/**
 * Fills a LOCAL __SERVER_DIR__ with sample data through its public admin API, so the panel has something to show:
 * a handful of items in every status (each write carries an audit reason). Run once after `qa/stack.sh`.
 * Usage: node qa/seed.mjs   (QA_API, ADMIN_EMAIL, ADMIN_PASSWORD, QA_ADMIN_TOKEN as in lib.mjs)
 */
import { adminToken, api, log, resetLog } from './lib.mjs';

resetLog();
const token = await adminToken();
const ITEMS = [
  ['Starter plan', 'ACTIVE', 'The first thing an admin creates'],
  ['Team plan', 'ACTIVE', 'Up to ten people'],
  ['Legacy plan', 'INACTIVE', null],
  ['Pilot batch', 'ARCHIVED', 'Kept for the audit trail'],
];
for (const [name, status, description] of ITEMS) {
  const created = await api(
    'admin',
    'POST',
    '/items',
    { name, description, status: 'ACTIVE', reason: 'QA seed' },
    token,
  );
  if (!created.ok) continue;
  if (status !== 'ACTIVE') {
    await api('admin', 'PATCH', `/items/${created.data.id}`, { status, reason: 'QA seed' }, token);
  }
  log('item', name, status, created.data.id);
}
const list = await api('admin', 'GET', '/items', undefined, token, '?page=1&pageSize=25');
console.log('SEED-DONE', list.data?.length ?? 0, 'items (log: qa-seed.log)');
