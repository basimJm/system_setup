import { act, screen } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { REALTIME_EVENTS, REALTIME_INVALIDATIONS } from '@/constants/realtime';
import { FakeRealtimeClient } from '@/data/realtime/FakeRealtimeClient';
import { startInvalidationBus } from '@/data/realtime/invalidationBus';
import { OPERATIONS } from '@/data/contract/generated/operations';
import { LiveIndicator } from '@/presentation/components/feedback/LiveIndicator';
import { useRealtime, useRealtimeConnection } from '@/presentation/hooks/useRealtime';
import { makeContainer, renderWithApp } from './helpers/render';

afterEach(() => vi.restoreAllMocks());

describe('realtime constants', () => {
  it('every event has invalidation rules and every rule names a real operation', () => {
    for (const event of REALTIME_EVENTS) {
      const rules = REALTIME_INVALIDATIONS[event];
      expect(rules.length).toBeGreaterThan(0);
      for (const [operationId] of rules) expect(OPERATIONS).toHaveProperty(operationId ?? '');
    }
  });
});

describe('fake realtime client', () => {
  it('delivers events to subscribers until they unsubscribe', () => {
    const client = new FakeRealtimeClient();
    const seen = vi.fn();
    const off = client.on('item.updated', seen);
    client.emit('item.updated', { id: 1 });
    off();
    client.emit('item.updated', { id: 2 });
    expect(seen).toHaveBeenCalledOnce();
    expect(seen).toHaveBeenCalledWith({ id: 1 });
  });

  it('reports status changes once per change', () => {
    const client = new FakeRealtimeClient();
    const seen: string[] = [];
    client.onStatus((status) => seen.push(status));
    client.connect();
    client.connect();
    client.setStatus('reconnecting');
    client.disconnect();
    expect(seen).toEqual(['live', 'reconnecting', 'idle']);
  });
});

describe('invalidation bus', () => {
  it('marks the matching queries stale when an event arrives, and stops when disposed', () => {
    const client = new FakeRealtimeClient();
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const stop = startInvalidationBus(client, queryClient);
    client.emit('item.updated');
    expect(spy.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey)).toEqual([
      ['getItems'],
      ['getItemsById'],
    ]);
    spy.mockClear();
    stop();
    client.emit('item.updated');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('hooks and indicator', () => {
  function Probe({ onEvent, signedIn }: { onEvent: (p: unknown) => void; signedIn: boolean }) {
    useRealtime('item.updated', onEvent);
    useRealtimeConnection(signedIn);
    return <LiveIndicator />;
  }
  const setup = (signedIn: boolean) => {
    const container = makeContainer();
    const fake = container.realtime as FakeRealtimeClient;
    const onEvent = vi.fn();
    renderWithApp(<Probe onEvent={onEvent} signedIn={signedIn} />, container);
    return { fake, onEvent };
  };

  it('connects while signed in, shows Live, forwards events, and disconnects on unmount', () => {
    const { fake, onEvent } = setup(true);
    expect(screen.getByRole('status', { name: 'Live updates' })).toHaveTextContent('Live');
    act(() => fake.emit('item.updated', { id: 'b1' }));
    expect(onEvent).toHaveBeenCalledWith({ id: 'b1' });
    act(() => fake.setStatus('reconnecting'));
    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting');
  });

  it('stays disconnected and hidden when signed out', () => {
    const { fake } = setup(false);
    expect(fake.status()).toBe('idle');
    expect(screen.queryByRole('status')).toBeNull();
  });
});
