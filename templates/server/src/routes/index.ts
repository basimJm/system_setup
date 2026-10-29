import { Router } from 'express';
import { WEBHOOK_PREFIX } from '../constants/providers';
import { API_PREFIXES, type ApiNamespace } from '../constants/server';
import { createAdminRouter } from '../modules/admin';
import { createCustomerRouter } from '../modules/customer';
import { createMerchantRouter } from '../modules/merchant';
import { unavailable, type ApiServices } from '../modules/services';
import { createWebhooksRouter } from '../modules/webhooks/webhooks.routes';
import type { PaymentProvider } from '../providers/payments';
import { createHealthRouter } from './health';
import { mount } from './mount';

export type NamespaceRouters = Readonly<Record<ApiNamespace, Router>>;

const defaultRouters = (services: ApiServices): NamespaceRouters => ({
  customer: createCustomerRouter(services),
  merchant: createMerchantRouter(services),
  admin: createAdminRouter(services),
});

/** Routes outside the client namespaces: gateway callbacks. */
export const defaultWebhooks = (services: ApiServices): { path: string; router: Router } => ({
  path: WEBHOOK_PREFIX,
  router: createWebhooksRouter({
    payments: services.payments ?? unavailable<PaymentProvider>(),
  }),
});

/** Root router: each client namespace lives under its own prefix and token scope. */
export const createRootRouter = (
  routers: NamespaceRouters = defaultRouters({}),
  health: Router = createHealthRouter(),
  extra: readonly { path: string; router: Router }[] = [defaultWebhooks({})],
): Router => {
  const root = Router();
  mount(root, '', health);
  mount(root, API_PREFIXES.customer, routers.customer);
  mount(root, API_PREFIXES.merchant, routers.merchant);
  mount(root, API_PREFIXES.admin, routers.admin);
  for (const { path, router } of extra) mount(root, path, router);
  return root;
};
