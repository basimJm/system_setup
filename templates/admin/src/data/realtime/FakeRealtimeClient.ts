import type { RealtimeClient, RealtimeHandler } from '@/domain/realtime/realtime';
import { createStatusStore } from './statusStore';

/** Mock-mode and test client: connects instantly and lets the code under test `emit` server events. */
export class FakeRealtimeClient implements RealtimeClient {
  private readonly store = createStatusStore();
  private readonly handlers = new Map<string, Set<RealtimeHandler>>();

  connect(): void {
    this.store.set('live');
  }
  disconnect(): void {
    this.store.set('idle');
  }
  on(event: string, handler: RealtimeHandler): () => void {
    const set = this.handlers.get(event) ?? new Set<RealtimeHandler>();
    set.add(handler);
    this.handlers.set(event, set);
    return () => set.delete(handler);
  }
  status = () => this.store.get();
  onStatus = (listener: Parameters<typeof this.store.subscribe>[0]) =>
    this.store.subscribe(listener);

  /** Test/dev helper: pretend the server sent `event`. */
  emit(event: string, payload: unknown = null): void {
    this.handlers.get(event)?.forEach((h) => h(payload));
  }
  /** Test/dev helper: force a status (e.g. `reconnecting`). */
  setStatus = (status: Parameters<typeof this.store.set>[0]) => this.store.set(status);
}
