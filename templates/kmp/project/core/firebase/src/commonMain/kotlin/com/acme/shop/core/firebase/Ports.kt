package com.acme.shop.core.firebase

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/** The FCM registration token: current value on demand plus every refresh the platform reports. */
interface PushTokenProvider {
    suspend fun currentToken(): String?
    val tokenUpdates: SharedFlow<String>
}

/** Platform services (the Android messaging service, the iOS messaging delegate) publish refreshed tokens here. */
object PushTokenRelay {
    private val updates = MutableSharedFlow<String>(replay = 1, extraBufferCapacity = 1)
    val tokenUpdates: SharedFlow<String> = updates.asSharedFlow()

    fun publish(token: String) {
        updates.tryEmit(token)
    }
}

/** Crashlytics as the app uses it: breadcrumbs, non-fatal errors and the user id. */
interface CrashReporter {
    fun log(message: String)
    fun recordNonFatal(throwable: Throwable)
    fun setUserId(userId: String?)
}

/**
 * The Firebase Analytics app-instance id: sent to the backend on login so guest history is linked to the
 * account; null when Analytics is unavailable (no Firebase config, collection disabled).
 */
interface AppInstanceIdProvider {
    suspend fun appInstanceId(): String?
}
