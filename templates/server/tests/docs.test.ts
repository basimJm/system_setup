import express, { Router } from 'express';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app';
import {
  DOC_NAMES,
  DOCS_ROUTE,
  MAX_EXAMPLE_DEPTH,
  POSTMAN_FILE_PREFIX,
} from '../src/constants/docs';
import { buildOpenApiDocuments } from '../src/docs';
import { generateDocFiles } from '../src/docs/generate';
import { buildPostmanCollection, exampleFromSchema } from '../src/docs/postman';
import { createRootRouter } from '../src/routes';
import { mount } from '../src/routes/mount';
import { createLogger } from '../src/utils/logger';
import { diffRoutesAndDocs, walkRoutes } from './helpers/routeDocs';

const root = join(__dirname, '..');
const logger = createLogger({ level: 'silent' });
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const COMMON_PATHS = ['/health', '/ready', '/webhooks/payments'];

describe('generated Swagger and Postman files (CLAUDE.md §11)', () => {
  const files = generateDocFiles();

  it('generates an OpenAPI file and a Postman collection per document, plus the environment', () => {
    const paths = Object.keys(files);
    for (const name of DOC_NAMES) {
      expect(paths).toContain(`docs/api/openapi.${name}.json`);
      expect(
        paths.some((p) =>
          p.includes(
            `${POSTMAN_FILE_PREFIX}-${name.charAt(0).toUpperCase()}${name.slice(1)}.postman_collection`,
          ),
        ),
      ).toBe(true);
    }
    expect(paths).toContain(`docs/api/postman/${POSTMAN_FILE_PREFIX}.postman_environment.json`);
  });

  it.each(Object.keys(files))('%s is committed and up to date (run `npm run docs`)', (path) => {
    expect(readFileSync(join(root, path), 'utf8')).toBe(files[path]);
  });

  it('is deterministic and never contains tokens, hosts other than the local default, or secrets', () => {
    expect(generateDocFiles()).toEqual(files);
    const all = Object.values(files).join('\n');
    expect(all).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
    expect(all).not.toMatch(/https?:\/\/(?!localhost|schema\.getpostman\.com)/);
  });
});

describe('route ↔ OpenAPI coverage', () => {
  const documented = (): Set<string> => {
    const set = new Set<string>();
    for (const document of Object.values(buildOpenApiDocuments())) {
      for (const [path, item] of Object.entries(document.paths ?? {})) {
        for (const method of HTTP_METHODS) if (method in item) set.add(`${method} ${path}`);
      }
    }
    return set;
  };

  it('documents every route and every documented path has a route', () => {
    const walk = walkRoutes(createRootRouter());
    expect(walk.unmounted).toBe(0);
    expect(walk.routes.size).toBeGreaterThan(0);
    expect(diffRoutesAndDocs(walk.routes, documented())).toEqual({
      undocumented: [],
      withoutRoute: [],
    });
  });

  it('detects a route that has no OpenAPI entry and a documented path without a route', () => {
    const router = Router();
    router.get('/customer/v1/ghosts/:id', (_req, res) => res.end());
    expect(diffRoutesAndDocs(walkRoutes(router).routes, documented()).undocumented).toEqual([
      'get /customer/v1/ghosts/{id}',
    ]);
    expect(diffRoutesAndDocs(new Set(), new Set(['get /ghost'])).withoutRoute).toEqual([
      'get /ghost',
    ]);
  });

  it('follows routers attached with mount() and flags bare router.use()', () => {
    const child = Router();
    child.get('/items/:id', (_req, res) => res.end());
    const parent = Router();
    mount(parent, '/v9', child);
    expect(walkRoutes(parent).routes).toEqual(new Set(['get /v9/items/{id}']));
    const sneaky = Router();
    const hidden = Router();
    hidden.get('/x', (_req, res) => res.end());
    sneaky.use('/hidden', hidden);
    expect(walkRoutes(sneaky).unmounted).toBe(1);
  });
});

describe('OpenAPI documents', () => {
  const documents = buildOpenApiDocuments();

  it('are OpenAPI 3.1; common holds health, readiness and the gateway callback', () => {
    for (const name of DOC_NAMES) expect(documents[name].openapi).toBe('3.1.0');
    expect(Object.keys(documents.common.paths ?? {})).toEqual(COMMON_PATHS);
  });

  it('use the shared error envelope and error codes', () => {
    const schema = documents.common.components?.schemas?.['ErrorResponse'] as {
      properties: { error: { properties: { code: { enum: string[] } } } };
    };
    expect(schema.properties.error.properties.code.enum).toContain('ITEM_NOT_FOUND');
    expect(JSON.stringify(documents.common.paths?.['/ready']?.get?.responses?.['503'])).toContain(
      'ErrorResponse',
    );
  });

  it('require a bearer token in the client namespaces but not in common', () => {
    expect(documents.common.security).toBeUndefined();
    for (const name of ['customer', 'merchant', 'admin'] as const) {
      expect(documents[name].security).toEqual([{ bearerAuth: [] }]);
      expect(documents[name].components?.securitySchemes).toHaveProperty('bearerAuth');
    }
  });
});

describe('Postman generation', () => {
  const documents = buildOpenApiDocuments();

  it('puts health requests in a folder with variables, no token needed', () => {
    const collection = buildPostmanCollection('common', documents.common) as {
      item: { name: string; item: { request: { url: { raw: string }; auth?: unknown } }[] }[];
      variable: { key: string }[];
    };
    expect(collection.item[0]?.name).toBe('Health');
    expect(collection.item[0]?.item.map((i) => i.request.url.raw)).toEqual([
      '{{baseUrl}}/health',
      '{{baseUrl}}/ready',
    ]);
    expect(collection.item[0]?.item[0]?.request.auth).toBeUndefined();
    expect(collection.variable.map((v) => v.key)).toEqual(['baseUrl', 'language']);
  });

  it('adds a bearer token variable, path variables, query and a JSON body for secured operations', () => {
    const fake = {
      openapi: '3.1.0',
      info: { title: 't', version: '1' },
      security: [{ bearerAuth: [] }],
      paths: {
        '/customer/v1/items/{id}': {
          post: {
            tags: ['Items'],
            summary: 'Update item',
            parameters: [
              { name: 'id', in: 'path', required: true },
              { name: 'page', in: 'query', required: false },
            ],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { name: { type: 'string' }, count: { type: 'integer' } },
                  },
                },
              },
            },
          },
        },
      },
    };
    const collection = buildPostmanCollection('customer', fake as never) as {
      item: { item: { request: Record<string, unknown> }[] }[];
      variable: { key: string }[];
    };
    const req = collection.item[0]?.item[0]?.request as {
      url: {
        raw: string;
        variable: { key: string }[];
        query: { key: string; disabled?: boolean }[];
      };
      auth: { bearer: { value: string }[] };
      body: { raw: string };
    };
    expect(req.url.raw).toBe('{{baseUrl}}/customer/v1/items/:id');
    expect(req.url.variable).toEqual([{ key: 'id', value: '' }]);
    expect(req.url.query).toEqual([{ key: 'page', value: '', disabled: true }]);
    expect(req.auth.bearer[0]?.value).toBe('{{customerToken}}');
    expect(JSON.parse(req.body.raw)).toEqual({ name: 'string', count: 0 });
    expect(collection.variable.map((v) => v.key)).toContain('customerToken');
  });
});

describe('exampleFromSchema', () => {
  const doc = {
    components: { schemas: { Item: { type: 'object', properties: { id: { type: 'string' } } } } },
  };

  it('builds examples from types, enums, consts, refs, arrays and compositions; stops on loops', () => {
    expect(exampleFromSchema({ type: 'integer' }, doc)).toBe(0);
    expect(exampleFromSchema({ enum: ['a', 'b'] }, doc)).toBe('a');
    expect(exampleFromSchema({ $ref: '#/components/schemas/Item' }, doc)).toEqual({ id: 'string' });
    expect(exampleFromSchema({ type: 'array', items: { type: 'number' } }, doc)).toEqual([0]);
    expect(
      exampleFromSchema(
        {
          allOf: [
            { type: 'object', properties: { a: { type: 'integer' } } },
            { type: 'object', properties: { b: { type: 'boolean' } } },
          ],
        },
        doc,
      ),
    ).toEqual({ a: 0, b: false });
    const loop = {
      components: {
        schemas: {
          Node: { type: 'object', properties: { next: { $ref: '#/components/schemas/Node' } } },
        },
      },
    };
    let depth = 0;
    let cursor: unknown = exampleFromSchema({ $ref: '#/components/schemas/Node' }, loop);
    while (typeof cursor === 'object' && cursor !== null && 'next' in cursor) {
      cursor = cursor.next;
      depth += 1;
    }
    expect(depth).toBeLessThanOrEqual(MAX_EXAMPLE_DEPTH);
  });
});

describe('Swagger UI (outside production)', () => {
  it('serves the UI and the raw documents at /docs when enabled, 404 otherwise', async () => {
    const app = createApp({ logger, docs: true });
    expect((await request(app).get(`${DOCS_ROUTE}/`)).headers['content-type']).toContain(
      'text/html',
    );
    const json = await request(app).get(`${DOCS_ROUTE}/common.json`);
    expect(Object.keys((json.body as { paths: object }).paths)).toEqual(COMMON_PATHS);
    expect((await request(app).get(`${DOCS_ROUTE}/nope.json`)).status).toBe(404);
    expect((await request(createApp({ logger })).get(`${DOCS_ROUTE}/common.json`)).status).toBe(
      404,
    );
    expect(express()).toBeDefined();
  });
});
