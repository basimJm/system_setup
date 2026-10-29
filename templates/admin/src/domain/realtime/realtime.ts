/** Connection state shown by the "live" indicator. */
export type RealtimeStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'denied';

export type RealtimeHandler = (payload: unknown) => void;

/** The only realtime surface the app depends on; Socket.IO (remote) and a fake emitter (mock) implement it. */
export interface RealtimeClient {
  /** Opens the connection; `getToken` is asked again on every reconnect so a refreshed token is used. */
  connect(getToken: () => string | null): void;
  disconnect(): void;
  /** Subscribes to a server event; returns the unsubscribe function. */
  on(event: string, handler: RealtimeHandler): () => void;
  status(): RealtimeStatus;
  onStatus(listener: (status: RealtimeStatus) => void): () => void;
}
