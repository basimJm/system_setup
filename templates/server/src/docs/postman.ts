import {
  DOC_TITLES,
  JSON_CONTENT_TYPE,
  MAX_EXAMPLE_DEPTH,
  POSTMAN_DEFAULT_LANGUAGE,
  POSTMAN_ENVIRONMENT_NAME,
  POSTMAN_SCHEMA_URL,
  POSTMAN_VARIABLES,
  SCHEMA_REF_PREFIX,
  type DocName,
} from '../constants/docs';
import { DEFAULT_PORT } from '../constants/env';
import type { OpenApiDocument } from './index';

type Json = Record<string, unknown>;

const isJson = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
const BASE_URL = `{{${POSTMAN_VARIABLES.baseUrl}}}`;
const GENERIC_STRING = 'string';

/** Builds an example value from a JSON schema (3.1), resolving `$ref`s, with a depth guard. */
export const exampleFromSchema = (schema: unknown, doc: Json, depth = 0): unknown => {
  if (!isJson(schema) || depth > MAX_EXAMPLE_DEPTH) return null;
  const ref = schema['$ref'];
  if (typeof ref === 'string' && ref.startsWith(SCHEMA_REF_PREFIX)) {
    const components = isJson(doc['components']) ? doc['components'] : {};
    const schemas = isJson(components['schemas']) ? components['schemas'] : {};
    return exampleFromSchema(schemas[ref.slice(SCHEMA_REF_PREFIX.length)], doc, depth + 1);
  }
  if ('example' in schema) return schema['example'];
  if ('const' in schema) return schema['const'];
  if (Array.isArray(schema['enum']) && schema['enum'].length > 0) return schema['enum'][0];
  for (const key of ['allOf', 'anyOf', 'oneOf'] as const) {
    const options = schema[key];
    if (Array.isArray(options) && options.length > 0) {
      if (key === 'allOf') {
        const merged: Json = {};
        for (const option of options) {
          const part = exampleFromSchema(option, doc, depth + 1);
          if (isJson(part)) Object.assign(merged, part);
        }
        return merged;
      }
      return exampleFromSchema(options[0], doc, depth + 1);
    }
  }
  const declared: unknown = schema['type'];
  const type = Array.isArray(declared)
    ? (declared as unknown[]).find((t) => t !== 'null')
    : declared;
  switch (type) {
    case 'object': {
      const properties = isJson(schema['properties']) ? schema['properties'] : {};
      return Object.fromEntries(
        Object.entries(properties).map(([key, value]) => [
          key,
          exampleFromSchema(value, doc, depth + 1),
        ]),
      );
    }
    case 'array':
      return [exampleFromSchema(schema['items'], doc, depth + 1)];
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return false;
    default:
      return GENERIC_STRING;
  }
};

const toPostmanPath = (path: string): string[] =>
  path
    .split('/')
    .filter((segment) => segment !== '')
    .map((segment) => segment.replace(/^\{(\w+)\}$/, ':$1'));

interface PostmanParameter {
  readonly key: string;
  readonly value: string;
  readonly description?: string;
  readonly disabled?: boolean;
}

const parametersOf = (operation: Json, location: string): PostmanParameter[] => {
  const list = Array.isArray(operation['parameters']) ? operation['parameters'] : [];
  return list
    .filter(isJson)
    .filter((p) => p['in'] === location)
    .map((p) => ({
      key: String(p['name']),
      value: '',
      ...(typeof p['description'] === 'string' ? { description: p['description'] } : {}),
      ...(p['required'] === true ? {} : { disabled: true }),
    }));
};

const buildRequest = (
  name: DocName,
  doc: Json,
  path: string,
  method: string,
  operation: Json,
): Json => {
  const secured = Array.isArray(operation['security'])
    ? operation['security'].length > 0
    : Array.isArray(doc['security']) && doc['security'].length > 0;
  const body = isJson(operation['requestBody']) ? operation['requestBody'] : undefined;
  const jsonBody =
    body !== undefined && isJson(body['content']) ? body['content'][JSON_CONTENT_TYPE] : undefined;
  const headers: PostmanParameter[] = [
    { key: 'Accept-Language', value: `{{${POSTMAN_VARIABLES.language}}}` },
    ...(jsonBody === undefined ? [] : [{ key: 'Content-Type', value: JSON_CONTENT_TYPE }]),
    ...parametersOf(operation, 'header').filter((h) => h.key.toLowerCase() !== 'accept-language'),
  ];
  const tokenVariable = POSTMAN_VARIABLES.tokens[name];
  return {
    method: method.toUpperCase(),
    header: headers,
    ...(secured && tokenVariable !== ''
      ? {
          auth: {
            type: 'bearer',
            bearer: [{ key: 'token', value: `{{${tokenVariable}}}`, type: 'string' }],
          },
        }
      : {}),
    url: {
      raw: `${BASE_URL}${path.replace(/\{(\w+)\}/g, ':$1')}`,
      host: [BASE_URL],
      path: toPostmanPath(path),
      query: parametersOf(operation, 'query'),
      variable: parametersOf(operation, 'path').map(({ key }) => ({ key, value: '' })),
    },
    ...(typeof operation['description'] === 'string'
      ? { description: operation['description'] }
      : {}),
    ...(isJson(jsonBody)
      ? {
          body: {
            mode: 'raw',
            raw: JSON.stringify(exampleFromSchema(jsonBody['schema'], doc), null, 2),
            options: { raw: { language: 'json' } },
          },
        }
      : {}),
  };
};

/** Postman Collection v2.1 for one OpenAPI document: one folder per tag, one request per operation. */
export const buildPostmanCollection = (name: DocName, document: OpenApiDocument): Json => {
  const doc = document as unknown as Json;
  const paths = isJson(doc['paths']) ? doc['paths'] : {};
  const folders = new Map<string, Json[]>();
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!isJson(pathItem)) continue;
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!isJson(operation)) continue;
      const tags = Array.isArray(operation['tags']) ? operation['tags'] : [];
      const folder = String(tags[0] ?? 'General');
      const item = {
        name:
          typeof operation['summary'] === 'string'
            ? operation['summary']
            : `${method.toUpperCase()} ${path}`,
        request: buildRequest(name, doc, path, method, operation),
      };
      folders.set(folder, [...(folders.get(folder) ?? []), item]);
    }
  }
  const tokenVariable = POSTMAN_VARIABLES.tokens[name];
  return {
    info: {
      name: DOC_TITLES[name],
      schema: POSTMAN_SCHEMA_URL,
      description: 'Generated by `npm run docs`. Do not edit by hand.',
    },
    item: [...folders].map(([folder, items]) => ({ name: folder, item: items })),
    variable: [
      { key: POSTMAN_VARIABLES.baseUrl, value: '' },
      { key: POSTMAN_VARIABLES.language, value: POSTMAN_DEFAULT_LANGUAGE },
      ...(tokenVariable === '' ? [] : [{ key: tokenVariable, value: '' }]),
    ],
  };
};

/** Shared environment template; tokens stay empty and are never committed. */
export const buildPostmanEnvironment = (): Json => ({
  name: POSTMAN_ENVIRONMENT_NAME,
  values: [
    {
      key: POSTMAN_VARIABLES.baseUrl,
      value: `http://localhost:${String(DEFAULT_PORT)}`,
      enabled: true,
    },
    { key: POSTMAN_VARIABLES.language, value: POSTMAN_DEFAULT_LANGUAGE, enabled: true },
    ...Object.values(POSTMAN_VARIABLES.tokens)
      .filter((key) => key !== '')
      .map((key) => ({ key, value: '', type: 'secret', enabled: true })),
  ],
});
