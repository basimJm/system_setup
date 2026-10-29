package com.acme.shop.core.realtime.di

import com.acme.shop.core.common.AppEnvironment
import com.acme.shop.core.domain.session.SessionStore
import com.acme.shop.core.network.client.PlatformEngineProvider
import com.acme.shop.core.realtime.FakeRealtimeClient
import com.acme.shop.core.realtime.RealtimeClient
import com.acme.shop.core.realtime.RealtimeConfig
import com.acme.shop.core.realtime.socketio.KtorWebSocketTransport
import com.acme.shop.core.realtime.socketio.RealtimeTransport
import com.acme.shop.core.realtime.socketio.SocketIoRealtimeClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.koin.dsl.module

/**
 * One realtime client per app: Socket.IO against the API host with the session's access token, or the fake when
 * the environment serves fixtures (`DATA_SOURCE=mock`, no socket server to talk to).
 */
val realtimeModule = module {
    single { RealtimeConfig(apiBaseUrl = get<AppEnvironment>().apiBaseUrl) }
    single<RealtimeTransport> { KtorWebSocketTransport(PlatformEngineProvider) }
    single<RealtimeClient> {
        val environment = get<AppEnvironment>()
        if (environment.usesMock) {
            FakeRealtimeClient()
        } else {
            val sessionStore = get<SessionStore>()
            SocketIoRealtimeClient(
                config = get(),
                transport = get(),
                accessToken = { sessionStore.tokens()?.accessToken },
                scope = CoroutineScope(SupervisorJob() + Dispatchers.Default),
            )
        }
    }
}
