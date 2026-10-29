import { FakeEmailSender, FakePushSender } from '../src/adapters/fake';
import { MemoryIdempotencyStore } from '../src/adapters/memory-idempotency';

describe('MemoryIdempotencyStore', () => {
  it('claims a key once per TTL and prunes', async () => {
    let now = 0;
    const store = new MemoryIdempotencyStore(() => new Date(now));
    expect(store.scope).toBe('local');
    await expect(store.claim('k', 100)).resolves.toBe(true);
    await expect(store.claim('k', 100)).resolves.toBe(false);
    now = 100;
    await expect(store.claim('k', 100)).resolves.toBe(true);
    await expect(store.claim('live', 10_000)).resolves.toBe(true);
    now = 500;
    expect(store.prune()).toBe(1);
    await expect(new MemoryIdempotencyStore().claim('x', 10)).resolves.toBe(true);
  });
});

describe('fake senders', () => {
  it('records pushes with invalid and flaky tokens', async () => {
    const sender = new FakePushSender();
    sender.invalid.add('bad');
    sender.flaky.add('slow');
    await expect(sender.send({ tokens: ['ok', 'bad', 'slow'], body: 'b' })).resolves.toEqual([
      { token: 'ok', status: 'SENT' },
      { token: 'bad', status: 'INVALID_TOKEN', errorCode: 'unregistered' },
      { token: 'slow', status: 'RETRYABLE', errorCode: 'unavailable' },
    ]);
    await expect(sender.send({ tokens: ['slow'], body: 'b' })).resolves.toEqual([
      { token: 'slow', status: 'SENT' },
    ]);
    expect(sender.delivered()).toEqual(['ok', 'slow', 'slow']);
    sender.failWith = new Error('down');
    await expect(sender.send({ tokens: ['ok'], body: 'b' })).rejects.toThrow('down');
  });

  it('records emails with a configurable status', async () => {
    const sender = new FakeEmailSender();
    const email = { to: ['a@b.co'], subject: 's', text: 't' };
    await expect(sender.send(email)).resolves.toEqual({ id: 'fake-1', status: 'SENT' });
    sender.status = 'QUEUED';
    await expect(sender.send(email)).resolves.toEqual({ id: 'fake-2', status: 'QUEUED' });
    sender.failWith = new Error('down');
    await expect(sender.send(email)).rejects.toThrow('down');
    expect(sender.sent).toHaveLength(2);
  });
});
