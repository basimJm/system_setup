import type { AppConfig } from '@/infrastructure/config/appConfig';
import type { RealtimeClient } from '@/domain/realtime/realtime';
import type { Logger } from '@/infrastructure/logger/logger';

/** Real vs fake by config only; the Socket.IO library is a lazy chunk and the fake is compiled out of prod. */
export async function createRealtime(config: AppConfig, logger: Logger): Promise<RealtimeClient> {
  if (__ALLOW_MOCK__ && config.dataSource === 'mock') {
    const { FakeRealtimeClient } = await import('./FakeRealtimeClient');
    return new FakeRealtimeClient();
  }
  const { SocketIoRealtimeClient } = await import('./SocketIoRealtimeClient');
  return new SocketIoRealtimeClient(config.socketUrl, logger);
}
