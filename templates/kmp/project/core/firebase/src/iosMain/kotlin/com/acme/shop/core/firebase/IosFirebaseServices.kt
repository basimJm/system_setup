package com.acme.shop.core.firebase

import com.acme.shop.core.analytics.AnalyticsBackend
import com.acme.shop.core.analytics.AnalyticsEvent
import com.acme.shop.core.analytics.AnalyticsValue
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

class IosPushTokenProvider : PushTokenProvider {
    override suspend fun currentToken(): String? {
        val bridge = FirebaseBridges.pushToken ?: return null
        return suspendCancellableCoroutine { continuation ->
            bridge.currentToken { token -> if (continuation.isActive) continuation.resume(token) }
        }
    }

    override val tokenUpdates: SharedFlow<String> get() = PushTokenRelay.tokenUpdates
}

class IosCrashReporter : CrashReporter {
    override fun log(message: String) {
        FirebaseBridges.crashReporter?.log(message)
    }

    override fun recordNonFatal(throwable: Throwable) {
        FirebaseBridges.crashReporter?.recordError(throwable.message ?: throwable::class.simpleName.orEmpty())
    }

    override fun setUserId(userId: String?) {
        FirebaseBridges.crashReporter?.setUserId(userId)
    }
}

class IosFirebaseAnalyticsBackend : AnalyticsBackend {
    override suspend fun logEvent(event: AnalyticsEvent) {
        FirebaseBridges.analytics?.logEvent(event.name, event.params.toBridgeParams())
    }

    override suspend fun setUserId(userId: String?) {
        FirebaseBridges.analytics?.setUserId(userId)
    }

    override suspend fun setUserProperty(key: String, value: String?) {
        FirebaseBridges.analytics?.setUserProperty(key, value)
    }
}

class IosAppInstanceIdProvider : AppInstanceIdProvider {
    override suspend fun appInstanceId(): String? = FirebaseBridges.analytics?.appInstanceId()
}

internal fun Map<String, AnalyticsValue>.toBridgeParams(): Map<String, Any> = mapValues { (_, value) ->
    when (value) {
        is AnalyticsValue.Text -> value.value
        is AnalyticsValue.Number -> value.value
        is AnalyticsValue.Decimal -> value.value
        is AnalyticsValue.Flag -> value.value.toString()
    }
}
