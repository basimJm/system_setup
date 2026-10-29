import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import type { Server as HttpServer } from 'node:http';
import { Server, type Namespace, type Socket } from 'socket.io';
import { AUTHORIZATION_HEADER, BEARER_PATTERN, type TokenScope } from '../constants/auth';
import {
  SOCKET_ADAPTER_KEY,
  SOCKET_ADAPTER_READY_TIMEOUT_MS,
  SOCKET_AUTH_FIELD,
  SOCKET_ERRORS,
  SOCKET_MAX_PAYLOAD_BYTES,
  SOCKET_NAMESPACES,
  SOCKET_PATH,
  SOCKET_PING_INTERVAL_MS,
  SOCKET_PING_TIMEOUT_MS,
  SOCKET_ROOMS,
} from '../constants/sockets';
import { withTimeout } from '../utils/async/timeout';
import { verifyAccessToken, type AccessTokenClaims } from '../utils/auth/accessToken';
import { UnauthorizedError } from '../utils/errors';
import type { Logger } from '../utils/logger';

/** What a connected socket carries after the handshake. */
export interface SocketIdentity {
  readonly claims: AccessTokenClaims;
  readonly rooms: readonly string[];
}

export interface SocketHub {
  /** Sends an event to every socket in `room` of the scope's namespace, on every instance. */
  emit(scope: TokenScope, room: string, event: string, payload: unknown): void;
  /** Adds the sockets of `room` to more rooms / removes them from rooms (permission changes). */
  join(scope: TokenScope, room: string, rooms: readonly string[]): void;
  leave(scope: TokenScope, room: string, rooms: readonly string[]): void;
  /** Disconnects every socket in the room (e.g. access revoked). */
  disconnect(scope: TokenScope, room: string): void;
  close(): Promise<void>;
}

export interface SocketServerOptions {
  readonly httpServer: HttpServer;
  /** Publisher connection; the subscriber is a duplicate of it. */
  readonly redis: Redis;
  readonly accessSecret: string;
  readonly corsAllowedOrigins: readonly string[];
  readonly logger: Logger;
  /**
   * Extra rooms for the account, decided during the handshake (tenant rooms by membership).
   * `null` refuses the connection (`FORBIDDEN`), e.g. a deactivated member.
   */
  readonly roomsFor?: (
    scope: TokenScope,
    claims: AccessTokenClaims,
  ) => Promise<readonly string[] | null>;
  /** Called after the handshake: joins rooms, loads permissions. */
  readonly onConnection?: (scope: TokenScope, socket: Socket, claims: AccessTokenClaims) => void;
  readonly now?: () => Date;
}

const tokenOf = (socket: Socket): string | undefined => {
  const fromAuth: unknown = (socket.handshake.auth as Record<string, unknown>)[SOCKET_AUTH_FIELD];
  if (typeof fromAuth === 'string') return fromAuth;
  const header = socket.handshake.headers[AUTHORIZATION_HEADER];
  return typeof header === 'string' ? BEARER_PATTERN.exec(header)?.[1] : undefined;
};

const rejection = (code: string): Error => Object.assign(new Error(code), { data: { code } });

/**
 * Socket.IO on the HTTP server with the Redis adapter, so an event emitted by one instance reaches
 * sockets connected to any other. A handshake needs a valid access token of the namespace's scope:
 * no/invalid/expired token → `UNAUTHORIZED`, a token of another scope → `FORBIDDEN` (CLAUDE.md §4.2).
 */
export const createSocketServer = (options: SocketServerOptions): SocketHub => {
  const { httpServer, redis, accessSecret, logger } = options;
  const now = options.now ?? ((): Date => new Date());
  const subscriber = redis.duplicate();
  const io = new Server(httpServer, {
    path: SOCKET_PATH,
    serveClient: false,
    cors: { origin: [...options.corsAllowedOrigins] },
    pingInterval: SOCKET_PING_INTERVAL_MS,
    pingTimeout: SOCKET_PING_TIMEOUT_MS,
    maxHttpBufferSize: SOCKET_MAX_PAYLOAD_BYTES,
    adapter: createAdapter(redis, subscriber, { key: SOCKET_ADAPTER_KEY }),
  });

  const namespaces = new Map<TokenScope, Namespace>();
  for (const [scope, path] of Object.entries(SOCKET_NAMESPACES) as [TokenScope, string][]) {
    const namespace = io.of(path);
    /** Checks the handshake; resolves to the refusal, or `undefined` when the socket may connect. */
    const handshake = async (socket: Socket): Promise<Error | undefined> => {
      const token = tokenOf(socket);
      if (token === undefined) return rejection(SOCKET_ERRORS.unauthorized);
      let claims: AccessTokenClaims;
      try {
        claims = verifyAccessToken(accessSecret, token, now());
      } catch (error) {
        if (!(error instanceof UnauthorizedError))
          logger.error({ err: error }, 'socket token check failed');
        return rejection(SOCKET_ERRORS.unauthorized);
      }
      if (claims.scope !== scope) return rejection(SOCKET_ERRORS.forbidden);
      try {
        const rooms = options.roomsFor === undefined ? [] : await options.roomsFor(scope, claims);
        if (rooms === null) return rejection(SOCKET_ERRORS.forbidden);
        (socket.data as SocketIdentity) = { claims, rooms };
        return undefined;
      } catch (error) {
        // A database blip is not the client's fault: it may retry with the same token.
        logger.error({ err: error }, 'socket rooms lookup failed');
        return rejection(SOCKET_ERRORS.unavailable);
      }
    };
    namespace.use((socket, next) => {
      void handshake(socket).then((refusal) => {
        next(refusal);
      });
    });
    namespace.on('connection', (socket) => {
      const { claims, rooms } = socket.data as SocketIdentity;
      for (const room of rooms) void socket.join(room);
      // Every account has its own room; tenant rooms come from `roomsFor` and `onConnection`.
      if (scope === 'customer') void socket.join(SOCKET_ROOMS.customer(claims.subjectId));
      if (scope === 'merchant') void socket.join(SOCKET_ROOMS.member(claims.subjectId));
      if (scope === 'admin') void socket.join(SOCKET_ROOMS.admin);
      options.onConnection?.(scope, socket, claims);
    });
    namespaces.set(scope, namespace);
  }

  const namespaceOf = (scope: TokenScope): Namespace => {
    const found = namespaces.get(scope);
    if (found === undefined) throw new RangeError(`unknown socket scope ${scope}`);
    return found;
  };

  return {
    emit: (scope, room, event, payload) => {
      namespaceOf(scope).to(room).emit(event, payload);
    },
    join: (scope, room, rooms) => {
      if (rooms.length > 0)
        namespaceOf(scope)
          .in(room)
          .socketsJoin([...rooms]);
    },
    leave: (scope, room, rooms) => {
      if (rooms.length > 0)
        namespaceOf(scope)
          .in(room)
          .socketsLeave([...rooms]);
    },
    disconnect: (scope, room) => {
      namespaceOf(scope).in(room).disconnectSockets(true);
    },
    // The HTTP server is closed by the caller; here only the sockets and the adapter's subscriber end.
    close: async () => {
      for (const namespace of namespaces.values()) namespace.disconnectSockets(true);
      io.engine.close();
      // Let the adapter's subscribe commands finish first: closing a half-open subscriber rejects them.
      try {
        if (subscriber.status !== 'ready') {
          await withTimeout(
            new Promise<void>((resolve) =>
              subscriber.once('ready', () => {
                resolve();
              }),
            ),
            SOCKET_ADAPTER_READY_TIMEOUT_MS,
          );
        }
        await subscriber.quit();
      } catch {
        subscriber.disconnect();
      }
    },
  };
};
