/** Converts the JSON Schema subset the server emits (OpenAPI 3.1) into zod 4 source code. */

export interface JsonSchema {
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  $ref?: string;
}

const COMPONENT_REF = /^#\/components\/schemas\/([A-Za-z0-9_]+)$/;
const NULL_TYPE = 'null';
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const STRING_FORMATS: Readonly<Record<string, string>> = {
  'date-time': 'z.iso.datetime({ offset: true })',
  date: 'z.iso.date()',
  email: 'z.email()',
  uri: 'z.url()',
  url: 'z.url()',
  uuid: 'z.uuid()',
};

export interface ZodContext {
  /** Builds the call that returns a named component schema, e.g. `ErrorResponse` -> `components.ErrorResponse()`. */
  componentRef(name: string): string;
}

const key = (name: string) => (IDENTIFIER.test(name) ? name : JSON.stringify(name));

function stringSchema(s: JsonSchema): string {
  let code = (s.format && STRING_FORMATS[s.format]) || 'z.string()';
  if (s.minLength !== undefined) code += `.min(${s.minLength})`;
  if (s.maxLength !== undefined) code += `.max(${s.maxLength})`;
  if (s.pattern !== undefined) code += `.regex(new RegExp(${JSON.stringify(s.pattern)}))`;
  return code;
}

function numberSchema(s: JsonSchema, integer: boolean): string {
  let code = integer ? 'z.number().int()' : 'z.number()';
  if (s.minimum !== undefined) code += `.min(${s.minimum})`;
  if (s.maximum !== undefined) code += `.max(${s.maximum})`;
  return code;
}

function enumSchema(values: readonly unknown[]): string {
  if (values.every((v): v is string => typeof v === 'string')) {
    return `z.enum(${JSON.stringify(values)})`;
  }
  const literals = values.map((v) => `z.literal(${JSON.stringify(v)})`);
  return literals.length === 1 ? (literals[0] ?? '') : `z.union([${literals.join(', ')}])`;
}

function objectSchema(s: JsonSchema, ctx: ZodContext): string {
  const required = new Set(s.required ?? []);
  const fields = Object.entries(s.properties ?? {}).map(([name, child]) => {
    const code = toZod(child, ctx);
    return `${key(name)}: ${required.has(name) ? code : `${code}.optional()`}`;
  });
  if (fields.length === 0 && typeof s.additionalProperties === 'object') {
    return `z.record(z.string(), ${toZod(s.additionalProperties, ctx)})`;
  }
  if (fields.length === 0 && s.additionalProperties === true)
    return 'z.record(z.string(), z.unknown())';
  return `z.object({ ${fields.join(', ')} })`;
}

function typedSchema(type: string, s: JsonSchema, ctx: ZodContext): string {
  switch (type) {
    case 'string':
      return s.enum ? enumSchema(s.enum.filter((v) => v !== null)) : stringSchema(s);
    case 'integer':
      return numberSchema(s, true);
    case 'number':
      return numberSchema(s, false);
    case 'boolean':
      return 'z.boolean()';
    case NULL_TYPE:
      return 'z.null()';
    case 'array': {
      let code = `z.array(${s.items ? toZod(s.items, ctx) : 'z.unknown()'})`;
      if (s.minItems !== undefined) code += `.min(${s.minItems})`;
      if (s.maxItems !== undefined) code += `.max(${s.maxItems})`;
      return code;
    }
    case 'object':
      return objectSchema(s, ctx);
    default:
      throw new Error(`Unsupported schema type "${type}"`);
  }
}

function refSchema(ref: string, ctx: ZodContext): string {
  const name = COMPONENT_REF.exec(ref)?.[1];
  if (!name) throw new Error(`Unsupported $ref "${ref}"`);
  return ctx.componentRef(name);
}

function combinedSchema(s: JsonSchema, ctx: ZodContext): string | undefined {
  const union = s.oneOf ?? s.anyOf;
  if (union) return `z.union([${union.map((part) => toZod(part, ctx)).join(', ')}])`;
  if (s.allOf) {
    return s.allOf.map((part) => toZod(part, ctx)).reduce((a, b) => `z.intersection(${a}, ${b})`);
  }
  return undefined;
}

function plainSchema(s: JsonSchema, ctx: ZodContext): string {
  const types = Array.isArray(s.type) ? s.type : s.type ? [s.type] : [];
  if (types.length === 0) return s.enum ? enumSchema(s.enum) : 'z.unknown()';
  const concrete = types.filter((t) => t !== NULL_TYPE);
  if (concrete.length === 0) return 'z.null()';
  const bodies = concrete.map((t) => typedSchema(t, s, ctx));
  const body = bodies.length === 1 ? (bodies[0] ?? '') : `z.union([${bodies.join(', ')}])`;
  const nullable = types.includes(NULL_TYPE) || s.enum?.includes(null) === true;
  return nullable ? `${body}.nullable()` : body;
}

/** Returns a zod expression (source text) for `schema`. Throws on constructs the generator does not know. */
export function toZod(schema: JsonSchema, ctx: ZodContext): string {
  if (schema.$ref !== undefined) return refSchema(schema.$ref, ctx);
  if (schema.const !== undefined) return `z.literal(${JSON.stringify(schema.const)})`;
  return combinedSchema(schema, ctx) ?? plainSchema(schema, ctx);
}
