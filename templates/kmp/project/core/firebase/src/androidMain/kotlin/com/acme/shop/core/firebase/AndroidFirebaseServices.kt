package com.acme.shop.core.firebase

import android.content.Context
import android.os.Bundle
import com.acme.shop.core.analytics.AnalyticsBackend
import com.acme.shop.core.analytics.AnalyticsEvent
import com.acme.shop.core.analytics.AnalyticsValue
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull
import java.io.IOException

/** How long [AndroidPushTokenProvider.currentToken] waits for `onRegistered` after `register()`. */
private const val REGISTRATION_TIMEOUT_MS = 15_000L

class AndroidPushTokenProvider(
    private val messaging: FirebaseMessaging = FirebaseMessaging.getInstance(),
) : PushTokenProvider {
    // FCM 26: `register()` replaces the deprecated `getToken()`; the token arrives in the messaging service's
    // `onRegistered`, which publishes it to [PushTokenRelay] (replay 1, so an earlier token is returned at once).
    // A placeholder Firebase config (no valid API key yet) raises IllegalArgumentException: no token, no crash.
    override suspend fun currentToken(): String? = try {
        messaging.register().awaitResult()
        withTimeoutOrNull(REGISTRATION_TIMEOUT_MS) { PushTokenRelay.tokenUpdates.first() } ?: existingToken()
    } catch (expected: IOException) {
        null
    } catch (expected: IllegalStateException) {
        null
    } catch (expected: IllegalArgumentException) {
        null
    }

    override val tokenUpdates: SharedFlow<String> get() = PushTokenRelay.tokenUpdates

    // An already-registered install may not get `onRegistered` again; read the stored registration once and relay it.
    @Suppress("DEPRECATION") // FCM 26: getToken() is the only read of an existing registration; register() covers new ones
    private suspend fun existingToken(): String? = messaging.token.awaitResult()?.also { PushTokenRelay.publish(it) }
}

class AndroidCrashReporter(
    private val crashlytics: FirebaseCrashlytics = FirebaseCrashlytics.getInstance(),
) : CrashReporter {
    override fun log(message: String) = crashlytics.log(message)
    override fun recordNonFatal(throwable: Throwable) = crashlytics.recordException(throwable)
    override fun setUserId(userId: String?) = crashlytics.setUserId(userId.orEmpty())
}

/** Sends the already validated, context-enriched events of `core/analytics` to Firebase Analytics. */
class AndroidFirebaseAnalyticsBackend(context: Context) : AnalyticsBackend {
    private val analytics: FirebaseAnalytics = FirebaseAnalytics.getInstance(context)

    override suspend fun logEvent(event: AnalyticsEvent) = analytics.logEvent(event.name, event.params.toBundle())
    override suspend fun setUserId(userId: String?) = analytics.setUserId(userId)
    override suspend fun setUserProperty(key: String, value: String?) = analytics.setUserProperty(key, value)
}

class AndroidAppInstanceIdProvider(context: Context) : AppInstanceIdProvider {
    private val analytics: FirebaseAnalytics = FirebaseAnalytics.getInstance(context)

    override suspend fun appInstanceId(): String? = try {
        analytics.appInstanceId.awaitResult()
    } catch (expected: IOException) {
        null
    } catch (expected: IllegalStateException) {
        null
    } catch (expected: IllegalArgumentException) {
        null
    }
}

internal fun Map<String, AnalyticsValue>.toBundle(): Bundle = Bundle().also { bundle ->
    forEach { (key, value) ->
        when (value) {
            is AnalyticsValue.Text -> bundle.putString(key, value.value)
            is AnalyticsValue.Number -> bundle.putLong(key, value.value)
            is AnalyticsValue.Decimal -> bundle.putDouble(key, value.value)
            is AnalyticsValue.Flag -> bundle.putString(key, value.value.toString())
        }
    }
}
