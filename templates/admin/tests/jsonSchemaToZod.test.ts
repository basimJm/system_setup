import { describe, expect, it } from 'vitest';
import { toZod, type JsonSchema, type ZodContext } from '../scripts/lib/jsonSchemaToZod.ts';

const ctx: ZodContext = { componentRef: (name) => `c.${name}()` };
const code = (schema: JsonSchema) => toZod(schema, ctx);

describe('toZod', () => {
  it('converts strings with length, pattern and formats', () => {
    expect(code({ type: 'string' })).toBe('z.string()');
    expect(code({ type: 'string', minLength: 1, maxLength: 5 })).toBe('z.string().min(1).max(5)');
    expect(code({ type: 'string', pattern: '^a\\d$' })).toBe(
      'z.string().regex(new RegExp("^a\\\\d$"))',
    );
    expect(code({ type: 'string', format: 'date-time' })).toBe('z.iso.datetime({ offset: true })');
    expect(code({ type: 'string', format: 'email' })).toBe('z.email()');
    expect(code({ type: 'string', format: 'unknown-format' })).toBe('z.string()');
  });

  it('converts numbers, integers, booleans and null', () => {
    expect(code({ type: 'integer', minimum: 1, maximum: 9 })).toBe(
      'z.number().int().min(1).max(9)',
    );
    expect(code({ type: 'number' })).toBe('z.number()');
    expect(code({ type: 'boolean' })).toBe('z.boolean()');
    expect(code({ type: 'null' })).toBe('z.null()');
  });

  it('converts enums, nullable types and nullable enums', () => {
    expect(code({ type: 'string', enum: ['A', 'B'] })).toBe('z.enum(["A","B"])');
    expect(code({ type: ['string', 'null'] })).toBe('z.string().nullable()');
    expect(code({ type: ['string', 'null'], enum: ['A', null] })).toBe('z.enum(["A"]).nullable()');
    expect(code({ type: 'boolean', const: true })).toBe('z.literal(true)');
    expect(code({ enum: [1, 2] })).toBe('z.union([z.literal(1), z.literal(2)])');
  });

  it('marks properties optional unless required, and quotes odd keys', () => {
    expect(
      code({
        type: 'object',
        properties: { id: { type: 'string' }, 'a-b': { type: 'number' } },
        required: ['id'],
      }),
    ).toBe('z.object({ id: z.string(), "a-b": z.number().optional() })');
  });

  it('converts arrays with bounds, records, unions, intersections and refs', () => {
    expect(code({ type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 })).toBe(
      'z.array(z.string()).min(1).max(3)',
    );
    expect(code({ type: 'array' })).toBe('z.array(z.unknown())');
    expect(code({ type: 'object', additionalProperties: { type: 'number' } })).toBe(
      'z.record(z.string(), z.number())',
    );
    expect(code({ type: 'object', additionalProperties: true })).toBe(
      'z.record(z.string(), z.unknown())',
    );
    expect(code({ oneOf: [{ type: 'string' }, { type: 'number' }] })).toBe(
      'z.union([z.string(), z.number()])',
    );
    expect(
      code({ allOf: [{ $ref: '#/components/schemas/A' }, { $ref: '#/components/schemas/B' }] }),
    ).toBe('z.intersection(c.A(), c.B())');
    expect(code({})).toBe('z.unknown()');
  });

  it('refuses constructs it does not understand instead of guessing', () => {
    expect(() => code({ $ref: '#/definitions/X' })).toThrow('Unsupported $ref');
    expect(() => code({ type: 'tuple' })).toThrow('Unsupported schema type');
  });
});
