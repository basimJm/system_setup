package com.acme.shop.core.realtime

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds
import kotlin.time.TimeMark
import kotlin.time.TimeSource

/** Why a screen refreshes its data: a socket event, an FCM message while open, or the app returning. */
enum class RefreshReason { Realtime, Push, Foreground }

/** Payload keys shared by the `entity.updated` summary and the FCM data message. */
object RealtimePayloadKeys {
    const val ID = "id"
    const val STATUS = "status"
    const val PAYMENT_STATUS = "paymentStatus"
    const val UPDATED_AT = "updatedAt"
}

/** The entity a `entity.updated` event is about; null when the payload carries no id. */
fun RealtimeEvent.entityId(): String? = runCatching {
    val obj = payload.jsonObject
    obj[RealtimePayloadKeys.ID]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() }
}.getOrNull()

/** How close in time a repeated [updateKey] counts as the same change delivered twice. */
object RealtimeRefreshDefaults {
    private const val DUPLICATE_WINDOW_SECONDS = 5
    val DUPLICATE_WINDOW: Duration = DUPLICATE_WINDOW_SECONDS.seconds
}

/**
 * Identity of an update: the same orders in the same state delivered twice (socket + push, or a reconnect replay)
 * must trigger one refresh. Events without an id are never considered duplicates. The server's orders summary has no
 * `updatedAt`, so the key also carries the payment status.
 */
fun RealtimeEvent.updateKey(): String? {
    val id = entityId() ?: return null
    val obj = runCatching { payload.jsonObject }.getOrNull()
    val parts = listOf(RealtimePayloadKeys.STATUS, RealtimePayloadKeys.PAYMENT_STATUS, RealtimePayloadKeys.UPDATED_AT)
        .map { key -> runCatching { obj?.get(key)?.jsonPrimitive?.content }.getOrNull().orEmpty() }
    return (listOf(name, id) + parts).joinToString(KEY_SEPARATOR)
}

private const val KEY_SEPARATOR = ":"

/**
 * Realtime events of [name] that matter to [entityId] (any entity when null), with a consecutive duplicate (same
 * [updateKey] within [duplicateWindow]) dropped so a socket replay or a push for the same change does not refresh twice.
 * A later event with the same key is a new change (e.g. a team reassignment keeps status and payment status) and refreshes.
 */
fun Flow<RealtimeEvent>.refreshesFor(
    name: String,
    entityId: String? = null,
    timeSource: TimeSource = TimeSource.Monotonic,
    duplicateWindow: Duration = RealtimeRefreshDefaults.DUPLICATE_WINDOW,
): Flow<RefreshReason> {
    var lastKey: String? = null
    var lastAt: TimeMark? = null
    return filter { it.name == name }
        .filter { event -> entityId == null || event.entityId().let { it == null || it == entityId } }
        .filter { event ->
            val key = event.updateKey()
            val duplicate = key != null && key == lastKey && lastAt?.let { it.elapsedNow() < duplicateWindow } == true
            if (key != null) {
                lastKey = key
                lastAt = timeSource.markNow()
            }
            !duplicate
        }
        .map { RefreshReason.Realtime }
}
