package com.acme.shop.core.realtime.socketio

import com.acme.shop.core.network.client.HttpEngineProvider
import io.ktor.client.HttpClient
import io.ktor.client.plugins.websocket.WebSockets
import io.ktor.client.plugins.websocket.webSocketSession
import io.ktor.websocket.Frame
import io.ktor.websocket.close
import io.ktor.websocket.readText
import kotlinx.coroutines.channels.ClosedReceiveChannelException

/** One open text WebSocket; [receive] answers null once the peer closed it. */
interface RealtimeConnection {
    suspend fun receive(): String?
    suspend fun send(text: String)
    suspend fun close()
}

/** Opens WebSockets; the Ktor implementation is the only platform-touching piece, tests use an in-memory transport. */
fun interface RealtimeTransport {
    suspend fun open(url: String): RealtimeConnection
}

class KtorWebSocketTransport(engineProvider: HttpEngineProvider) : RealtimeTransport {
    private val client = HttpClient(engineProvider.create()) { install(WebSockets) }

    override suspend fun open(url: String): RealtimeConnection {
        val session = client.webSocketSession(url)
        return object : RealtimeConnection {
            override suspend fun receive(): String? {
                while (true) {
                    val frame = try {
                        session.incoming.receive()
                    } catch (ignored: ClosedReceiveChannelException) {
                        return null
                    }
                    if (frame is Frame.Text) return frame.readText()
                    if (frame is Frame.Close) return null
                }
            }

            override suspend fun send(text: String) = session.send(Frame.Text(text))

            override suspend fun close() = session.close()
        }
    }
}
