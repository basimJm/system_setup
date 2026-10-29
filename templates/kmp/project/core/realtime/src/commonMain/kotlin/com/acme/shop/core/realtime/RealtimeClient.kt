package com.acme.shop.core.realtime

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull

/** Server → customer events of BUSINESS_DOMAIN §7 (names exactly as the server's `SOCKET_EVENTS`). */
object RealtimeEvents {
    /** Example event: an entity changed on the server (payload `{id, status, updatedAt}`). */
    const val ENTITY_UPDATED = "entity.updated"
    const val NOTIFICATIONS_UNREAD = "notifications.unread"
}

/** One event from the customer room; features decode [payload] into their own models. */
data class RealtimeEvent(
    val name: String,
    val payload: JsonElement = JsonNull,
)

enum class RealtimeStatus {
    Disconnected,
    Connecting,
    Connected,

    /** The server refused the access token; the client stops until the app connects again with a fresh one. */
    Unauthorized,

    /** Transport or server failure; the client keeps retrying with backoff while a connection is wanted. */
    Reconnecting,
}

/**
 * The authenticated Socket.IO connection of a registered customer: connected while the app is in the
 * foreground and signed in, reconnects on its own, exposes the server events and the connection status.
 */
interface RealtimeClient {
    val status: StateFlow<RealtimeStatus>
    val events: SharedFlow<RealtimeEvent>

    /** Opens (or keeps) the connection with the current access token; idempotent. */
    fun connect()

    fun disconnect()
}

/** Scriptable client for tests, previews and the mock data source: features push events through [emit]. */
class FakeRealtimeClient : RealtimeClient {
    private val statusState = MutableStateFlow(RealtimeStatus.Disconnected)
    private val eventFlow = MutableSharedFlow<RealtimeEvent>(extraBufferCapacity = EVENT_BUFFER)
    var connectCalls: Int = 0
        private set

    override val status: StateFlow<RealtimeStatus> = statusState.asStateFlow()
    override val events: SharedFlow<RealtimeEvent> = eventFlow.asSharedFlow()

    override fun connect() {
        connectCalls += 1
        statusState.value = RealtimeStatus.Connected
    }

    override fun disconnect() {
        statusState.value = RealtimeStatus.Disconnected
    }

    fun emit(event: RealtimeEvent): Boolean = eventFlow.tryEmit(event)

    private companion object {
        const val EVENT_BUFFER = 16
    }
}
