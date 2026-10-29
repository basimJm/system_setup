import { describe, expect, it } from 'vitest';
import { buildApiDoc, findConsumers, parseAppendixA } from '../scripts/lib/apiDoc';
import type { OperationInfo } from '../scripts/lib/contract';

const op = (id: string, method: string, path: string): OperationInfo =>
  ({
    id,
    method,
    path,
    tag: 't',
    summary: 's',
    status: 200,
    hasBody: false,
    hasQuery: false,
    hasMeta: false,
  }) as OperationInfo;

const APPENDIX = [
  '| Operation | Summary (server) | Consumed by |',
  '|---|---|---|',
  '| `GET /alerts` | Alerts | ADM-061 |',
  '| `POST /alerts/{id}/acknowledge` | Ack | ADM-061, ADM-062 |',
  '| `GET /orphan` | Nobody | — |',
].join('\n');

describe('parseAppendixA', () => {
  it('reads each operation row with its tasks and ignores other tables', () => {
    const map = parseAppendixA(`${APPENDIX}\n| ADM-001 | not an operation | TODO |`);
    expect(map.get('GET /alerts')).toEqual(['ADM-061']);
    expect(map.get('POST /alerts/{id}/acknowledge')).toEqual(['ADM-061', 'ADM-062']);
    expect(map.get('GET /orphan')).toEqual([]);
    expect(map.size).toBe(3);
  });
});

describe('findConsumers', () => {
  it('lists each file once per operation, sorted', () => {
    const map = findConsumers([
      { path: 'b.ts', text: 'OPERATIONS.getAlerts; OPERATIONS.getAlerts' },
      { path: 'a.ts', text: 'x OPERATIONS.getAlerts y' },
      { path: 'c.ts', text: 'nothing' },
    ]);
    expect(map.get('getAlerts')).toEqual(['a.ts', 'b.ts']);
    expect(map.has('nothing')).toBe(false);
  });
});

describe('buildApiDoc', () => {
  const operations = [
    op('getAlerts', 'get', '/admin/v1/alerts'),
    op('getOrphan', 'get', '/admin/v1/orphan'),
  ];
  const appendixA = parseAppendixA(APPENDIX);

  it('marks implemented and planned operations and counts them', () => {
    const { markdown, problems } = buildApiDoc({
      operations: operations.slice(0, 1),
      appendixA,
      consumers: new Map([['getAlerts', ['src/x.ts']]]),
      exemptions: {},
    });
    expect(problems).toEqual([]);
    expect(markdown).toContain(
      '| `GET /alerts` | `getAlerts` | ADM-061 | `src/x.ts` | Implemented |',
    );
    expect(markdown).toContain('1 operations: 1 implemented, 0 planned or exempt.');
  });

  it('fails an operation with no task, no code and no exemption', () => {
    const { problems } = buildApiDoc({
      operations,
      appendixA,
      consumers: new Map(),
      exemptions: {},
    });
    expect(problems).toEqual([
      'GET /orphan (getOrphan) has no consuming task, no consumer in code and no exemption',
    ]);
  });

  it('accepts an exemption and reports one that names no operation', () => {
    const { markdown, problems } = buildApiDoc({
      operations,
      appendixA,
      consumers: new Map(),
      exemptions: { getOrphan: 'server only', gone: 'old' },
    });
    expect(problems).toEqual(['exemption "gone" names no operation']);
    expect(markdown).toContain('exempt: server only');
    expect(markdown).toContain('| Exempt |');
  });

  it('is deterministic whatever the input order', () => {
    const input = {
      appendixA,
      consumers: new Map<string, string[]>(),
      exemptions: { getOrphan: 'x' },
    };
    const a = buildApiDoc({ ...input, operations }).markdown;
    const b = buildApiDoc({ ...input, operations: [...operations].reverse() }).markdown;
    expect(a).toBe(b);
  });
});
