package com.acme.shop.core.notification.push

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow

/** FCM data keys the server sends with every push. */
object PushKeys {
    const val TITLE = "title"
    const val BODY = "body"
    const val EVENT = "event"
    const val NOTIFICATION_ID = "notificationId"
    const val DEEP_LINK = "deepLink"
}

/** Builds the shared model from a platform message; null when there is nothing to show. */
fun pushNotificationOf(data: Map<String, String>, title: String? = null, body: String? = null): PushNotification? {
    val shownTitle = title?.takeIf { it.isNotBlank() } ?: data[PushKeys.TITLE].orEmpty()
    val shownBody = body?.takeIf { it.isNotBlank() } ?: data[PushKeys.BODY].orEmpty()
    if (shownTitle.isBlank() && shownBody.isBlank()) return null
    return PushNotification(
        title = shownTitle,
        message = shownBody,
        data = data,
        deepLink = data[PushKeys.DEEP_LINK]?.takeIf { it.isNotBlank() },
    )
}

/**
 * Bridge between the platform push services and the shared shell: foreground messages become in-app
 * banners, a tapped system notification is kept until the shell can route it, and [appForeground] tells the
 * Android service whether to post a system notification at all.
 */
object PushSignals {
    private val foregroundMessages = MutableSharedFlow<PushNotification>(extraBufferCapacity = FOREGROUND_BUFFER)
    private val pendingTap = MutableStateFlow<PushNotification?>(null)
    private val foreground = MutableStateFlow(false)

    val messages: SharedFlow<PushNotification> get() = foregroundMessages.asSharedFlow()
    val tap: StateFlow<PushNotification?> get() = pendingTap
    val appForeground: StateFlow<Boolean> get() = foreground

    fun publishReceived(notification: PushNotification) {
        foregroundMessages.tryEmit(notification)
    }

    fun tapped(notification: PushNotification) {
        pendingTap.value = notification
    }

    fun consumeTap(notification: PushNotification) {
        pendingTap.compareAndSet(notification, null)
    }

    fun setAppForeground(isForeground: Boolean) {
        foreground.value = isForeground
    }

    private const val FOREGROUND_BUFFER = 8
}
