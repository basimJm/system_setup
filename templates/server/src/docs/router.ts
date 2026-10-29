import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { DOC_NAMES, DOC_TITLES, DOCS_ROUTE, type DocName } from '../constants/docs';
import { NotFoundError } from '../utils/errors';
import type { OpenApiDocument } from './index';

const JSON_SUFFIX = '.json';

const isDocName = (value: string): value is DocName => DOC_NAMES.some((name) => name === value);

/**
 * Swagger UI at `/docs` with the raw OpenAPI documents at `/docs/<name>.json`.
 * Developer tooling, not an API endpoint, so it is mounted only outside production.
 */
export const createDocsRouter = (documents: Readonly<Record<DocName, OpenApiDocument>>): Router => {
  const router = Router();
  router.get(`${DOCS_ROUTE}/:file`, (req, res, next) => {
    const file = req.params['file'];
    if (!file.endsWith(JSON_SUFFIX)) {
      next(); // Swagger UI's own assets
      return;
    }
    const name = file.slice(0, -JSON_SUFFIX.length);
    if (!isDocName(name)) {
      next(new NotFoundError());
      return;
    }
    res.json(documents[name]);
  });
  router.use(
    DOCS_ROUTE,
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      explorer: true,
      swaggerOptions: {
        urls: DOC_NAMES.map((name) => ({
          name: DOC_TITLES[name],
          url: `${DOCS_ROUTE}/${name}${JSON_SUFFIX}`,
        })),
      },
    }),
  );
  return router;
};
