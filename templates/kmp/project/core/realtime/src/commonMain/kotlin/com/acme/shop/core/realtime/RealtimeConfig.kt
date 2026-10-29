package com.acme.shop.core.realtime

import io.ktor.http.URLBuilder
import io.ktor.http.URLProtocol

private const val PARAM_ENGINE_VERSION = "EIO"
private const val ENGINE_VERSION = "4"
private const val PARAM_TRANSPORT = "transport"
private const val TRANSPORT_WEBSOCKET = "websocket"
private const val PATH_SEPARATOR = '/'

/** Values of the server's `constants/sockets.ts`; the socket shares the API host (one HTTP server). */
object RealtimeDefaults {
    const val SOCKET_PATH = "/socket.io/"
    const val APP_NAMESPACE = "/app"
    const val PING_INTERVAL_MS = 25_000L
    const val PING_TIMEOUT_MS = 20_000L
    const val RECONNECT_BASE_DELAY_MS = 1_000L
    const val RECONNECT_MAX_DELAY_MS = 30_000L
    const val RECONNECT_FACTOR = 2
    const val HANDSHAKE_TIMEOUT_MS = 10_000L
    const val EVENT_BUFFER = 64
}

data class RealtimeConfig(
    val apiBaseUrl: String,
    val namespace: String = RealtimeDefaults.APP_NAMESPACE,
    val path: String = RealtimeDefaults.SOCKET_PATH,
) {
    /** `https://api.example/` → `wss://api.example/socket.io/?EIO=4&transport=websocket` (plain http → ws). */
    val webSocketUrl: String
        get() {
            val builder = URLBuilder(apiBaseUrl.trim())
            val plain = builder.protocol == URLProtocol.HTTP || builder.protocol == URLProtocol.WS
            builder.protocol = if (plain) URLProtocol.WS else URLProtocol.WSS
            builder.encodedPathSegments = path.split(PATH_SEPARATOR)
            builder.parameters.clear()
            builder.parameters.append(PARAM_ENGINE_VERSION, ENGINE_VERSION)
            builder.parameters.append(PARAM_TRANSPORT, TRANSPORT_WEBSOCKET)
            return builder.buildString()
        }
}

/** Exponential backoff with a cap: attempt 0 → base, 1 → base·factor, … never above the cap. */
fun reconnectDelayMs(
    attempt: Int,
    baseMs: Long = RealtimeDefaults.RECONNECT_BASE_DELAY_MS,
    maxMs: Long = RealtimeDefaults.RECONNECT_MAX_DELAY_MS,
    factor: Int = RealtimeDefaults.RECONNECT_FACTOR,
): Long {
    var delay = baseMs
    repeat(attempt.coerceAtLeast(0)) { delay = (delay * factor).coerceAtMost(maxMs) }
    return delay.coerceAtMost(maxMs)
}
