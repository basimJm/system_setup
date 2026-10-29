import { auditRoutes } from './auditRoutes';
import { itemsRoutes } from './itemsRoutes';
import { settingsRoutes } from './settingsRoutes';
import type { MockRoute } from './mockTransport';

/**
 * Everything the mock server serves, typed by the contract. State lives in closures, so every app container
 * (and every test) gets its own copy. Each feature task adds its routes file here.
 */
export function createMockRoutes(): readonly MockRoute[] {
  return [...settingsRoutes(), ...itemsRoutes(), ...auditRoutes()];
}
