import { Fake__SDK_TITLE__Port } from '../src/adapters/fake';
import { assertPortContract } from './contract/port.contract';

describe('Fake__SDK_TITLE__Port', () => {
  it('honours the port contract', async () => {
    await expect(assertPortContract(new Fake__SDK_TITLE__Port())).resolves.toBeUndefined();
  });

  it('the contract rejects an adapter without a name, an id or a known status', async () => {
    const make = (name: string, id: string, status: string) =>
      ({
        name,
        execute: () => Promise.resolve({ id, status }),
      }) as unknown as Fake__SDK_TITLE__Port;
    await expect(assertPortContract(make(' ', 'a', 'DONE'))).rejects.toThrow('name');
    await expect(assertPortContract(make('x', ' ', 'DONE'))).rejects.toThrow('id');
    await expect(assertPortContract(make('x', 'a', 'NOPE'))).rejects.toThrow('status');
  });

  it('records requests and numbers the results', async () => {
    const port = new Fake__SDK_TITLE__Port();
    const first = await port.execute({ operation: 'a', payload: {} });
    const second = await port.execute({ operation: 'b', payload: { n: 1 } });
    expect([first.id, second.id]).toEqual(['fake-1', 'fake-2']);
    expect(port.executed.map((r) => r.operation)).toEqual(['a', 'b']);
  });

  it('fails while failWith is set and records nothing', async () => {
    const port = new Fake__SDK_TITLE__Port();
    port.failWith = new Error('down');
    await expect(port.execute({ operation: 'a', payload: {} })).rejects.toThrow('down');
    expect(port.executed).toHaveLength(0);
  });
});
