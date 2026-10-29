import { io, type Socket } from 'socket.io-client';
import {
  REALTIME_AUTH_FIELD,
  REALTIME_CONNECT_ERRORS,
  REALTIME_NAMESPACE,
  REALTIME_RECONNECT,
  REALTIME_SOCKET_PATH,
} from '@/constants/realtime';
import type { RealtimeClient, RealtimeHandler } from '@/domain/realtime/realtime';
import type { Logger } from '@/infrastructure/logger/logger';
import { createStatusStore } from './statusStore';

/** Backoff without jitter for retries the client schedules itself (middleware refusals are not retried by Socket.IO). */
export const retryDelayMs = (attempt: number): number =>
  Math.min(REALTIME_RECONNECT.baseMs * 2 ** attempt, REALTIME_RECONNECT.maxMs);

/** Socket.IO on the server's `/admin` namespace; the access token travels in `auth.token`. */
export class SocketIoRealtimeClient implements RealtimeClient {
  private socket: Socket | null = null;
  private readonly store = createStatusStore();
  private readonly handlers = new Map<string, Set<RealtimeHandler>>();
  private getToken: () => string | null = () => null;
  /** The token sent in the last handshake: an UNAUTHORIZED answer is only retried with a different one. */
  private sentToken: string | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;

  constructor(
    private readonly baseUrl: string,
    private readonly logger: Logger,
  ) {}

  connect(getToken: () => string | null): void {
    if (this.socket) return;
    this.getToken = getToken;
    this.store.set('connecting');
    const socket = io(`${this.baseUrl}${REALTIME_NAMESPACE}`, {
      path: REALTIME_SOCKET_PATH,
      transports: ['websocket'],
      reconnectionDelay: REALTIME_RECONNECT.baseMs,
      reconnectionDelayMax: REALTIME_RECONNECT.maxMs,
      randomizationFactor: REALTIME_RECONNECT.randomization,
      auth: (done) => {
        this.sentToken = getToken();
        done({ [REALTIME_AUTH_FIELD]: this.sentToken });
      },
    });
    socket.on('connect', () => {
      this.attempt = 0;
      this.store.set('live');
    });
    socket.on('disconnect', () => this.store.set('reconnecting'));
    socket.on('connect_error', (error) => this.onConnectError(socket, error));
    this.handlers.forEach((set, event) => set.forEach((h) => socket.on(event, h)));
    this.socket = socket;
  }

  private onConnectError(socket: Socket, error: Error): void {
    if (error.message === REALTIME_CONNECT_ERRORS.forbidden) {
      // A token of another scope can never join /admin: stop for good, the session layer handles sign-in.
      this.logger.warn('realtime.denied', { reason: error.message });
      this.store.set('denied');
      socket.disconnect();
      return;
    }
    if (error.message === REALTIME_CONNECT_ERRORS.unauthorized) {
      // Usually an access token that expired while the socket was down: wait for the session to refresh it.
      this.logger.warn('realtime.denied', { reason: error.message });
      this.store.set('denied');
      this.scheduleRetry(socket, true);
      return;
    }
    this.store.set('reconnecting');
    // Transport errors are retried by Socket.IO itself (`active`); a middleware refusal (UNAVAILABLE) is not.
    if (!socket.active) this.scheduleRetry(socket, false);
  }

  private scheduleRetry(socket: Socket, needsNewToken: boolean): void {
    this.clearRetry();
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.attempt += 1;
      const token = this.getToken();
      if (needsNewToken && (token === null || token === this.sentToken)) {
        this.scheduleRetry(socket, true);
        return;
      }
      this.store.set('connecting');
      socket.connect();
    }, retryDelayMs(this.attempt));
  }

  private clearRetry(): void {
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  disconnect(): void {
    this.clearRetry();
    this.attempt = 0;
    this.socket?.disconnect();
    this.socket = null;
    this.store.set('idle');
  }

  on(event: string, handler: RealtimeHandler): () => void {
    const set = this.handlers.get(event) ?? new Set<RealtimeHandler>();
    set.add(handler);
    this.handlers.set(event, set);
    this.socket?.on(event, handler);
    return () => {
      set.delete(handler);
      this.socket?.off(event, handler);
    };
  }

  status = () => this.store.get();
  onStatus = (listener: Parameters<typeof this.store.subscribe>[0]) =>
    this.store.subscribe(listener);
}
