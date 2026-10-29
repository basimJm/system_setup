import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import {
  BEARER_SCHEME,
  DOC_NAMES,
  DOC_TITLES,
  OPENAPI_VERSION,
  type DocName,
} from '../constants/docs';
import { API_PREFIXES } from '../constants/server';
import { registerAdminAuditLogDocs } from '../modules/admin/auditLogs/auditLogs.openapi';
import { registerAdminAuthDocs } from '../modules/admin/auth/auth.openapi';
import { registerAdminSettingsDocs } from '../modules/admin/settings/settings.openapi';
import { registerCustomerAuthDocs } from '../modules/customer/auth/auth.openapi';
import { registerCustomerProfileDocs } from '../modules/customer/profile/profile.openapi';
import { registerMerchantAuthDocs } from '../modules/merchant/auth/auth.openapi';
import { registerMerchantMeDocs } from '../modules/merchant/me/me.openapi';
import { registerMerchantTeamDocs } from '../modules/merchant/team/team.openapi';
import {
  registerAdminItemDocs,
  registerCustomerItemDocs,
  registerMerchantItemDocs,
} from '../modules/shared/items/items.openapi';
import { registerNotificationDocs } from '../modules/shared/notifications/notifications.openapi';
import {
  registerCustomerOtpDocs,
  registerMerchantOtpDocs,
} from '../modules/shared/otp/otp.openapi';
import {
  registerAdminUploadDocs,
  registerCustomerUploadDocs,
  registerMerchantUploadDocs,
} from '../modules/shared/uploads/uploads.openapi';
import { registerPaymentWebhookDocs } from '../modules/webhooks/webhooks.openapi';
import { registerHealthDocs } from '../routes/health.openapi';
import { CONTRACT_VERSIONS } from './contractVersions';
import { errorResponseSchema, paginationMetaSchema } from './schemas';

type DocumentConfig = Parameters<OpenApiGeneratorV31['generateDocument']>[0];
type Registrar = (registry: OpenAPIRegistry) => void;

/**
 * Add each feature's `register<Feature>Docs` here, under the namespace it belongs to
 * (CLAUDE.md §11). Order is the order paths appear in the generated files.
 */
const REGISTRARS: Readonly<Record<DocName, readonly Registrar[]>> = {
  common: [registerHealthDocs, registerPaymentWebhookDocs],
  customer: [
    registerCustomerOtpDocs,
    registerCustomerAuthDocs,
    registerCustomerProfileDocs,
    registerCustomerUploadDocs,
    registerNotificationDocs(API_PREFIXES.customer),
    registerCustomerItemDocs,
  ],
  merchant: [
    registerMerchantOtpDocs,
    registerMerchantAuthDocs,
    registerMerchantMeDocs,
    registerMerchantTeamDocs,
    registerMerchantUploadDocs,
    registerNotificationDocs(API_PREFIXES.merchant),
    registerMerchantItemDocs,
  ],
  admin: [
    registerAdminAuthDocs,
    registerAdminSettingsDocs,
    registerAdminAuditLogDocs,
    registerAdminUploadDocs,
    registerAdminItemDocs,
  ],
};

const buildDocument = (name: DocName): ReturnType<OpenApiGeneratorV31['generateDocument']> => {
  const registry = new OpenAPIRegistry();
  registry.register('ErrorResponse', errorResponseSchema);
  registry.register('PaginationMeta', paginationMetaSchema);
  if (name !== 'common') {
    registry.registerComponent('securitySchemes', BEARER_SCHEME, {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
  }
  for (const register of REGISTRARS[name]) register(registry);
  const config: DocumentConfig = {
    openapi: OPENAPI_VERSION,
    info: { title: DOC_TITLES[name], version: CONTRACT_VERSIONS[name].version },
    servers: [{ url: '/' }],
    ...(name === 'common' ? {} : { security: [{ [BEARER_SCHEME]: [] }] }),
  };
  return new OpenApiGeneratorV31(registry.definitions).generateDocument(config);
};

export type OpenApiDocument = ReturnType<typeof buildDocument>;

/** One OpenAPI document per name; the single input of Swagger UI, the files and Postman. */
export const buildOpenApiDocuments = (): Record<DocName, OpenApiDocument> =>
  Object.fromEntries(DOC_NAMES.map((name) => [name, buildDocument(name)])) as Record<
    DocName,
    OpenApiDocument
  >;
