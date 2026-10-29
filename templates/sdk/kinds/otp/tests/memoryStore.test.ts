import { MemoryCodeStore } from '../src/adapters/memory-store';

describe('MemoryCodeStore', () => {
  it('stores with TTL, counts, sets if absent and prunes', async () => {
    let now = 0;
    const store = new MemoryCodeStore(() => new Date(now));
    expect(store.scope).toBe('local');
    await store.set('a', '1', 100);
    await expect(store.get('a')).resolves.toBe('1');
    await expect(store.ttlMs('a')).resolves.toBe(100);
    await expect(store.setIfAbsent('a', '2', 100)).resolves.toBe(false);
    await expect(store.setIfAbsent('b', '2', 50)).resolves.toBe(true);
    await expect(store.increment('c', 100)).resolves.toBe(1);
    await expect(store.increment('c', 100)).resolves.toBe(2);
    now = 60;
    await expect(store.get('b')).resolves.toBeNull();
    await expect(store.ttlMs('b')).resolves.toBe(0);
    await expect(store.delete('a')).resolves.toBe(true);
    await expect(store.delete('a')).resolves.toBe(false);
    expect(store.size).toBe(1);
    now = 200;
    await expect(store.increment('c', 100)).resolves.toBe(1);
    await store.set('d', 'x', 10);
    now = 400;
    expect(store.prune()).toBe(0);
    await expect(store.get('nope')).resolves.toBeNull();
  });

  it('uses the wall clock by default', async () => {
    const store = new MemoryCodeStore();
    await store.set('k', 'v', 10_000);
    await expect(store.get('k')).resolves.toBe('v');
  });
});
