package com.acme.shop.core.firebase

import kotlinx.coroutines.flow.SharedFlow

class FakePushTokenProvider(var token: String? = null) : PushTokenProvider {
    override suspend fun currentToken(): String? = token
    override val tokenUpdates: SharedFlow<String> get() = PushTokenRelay.tokenUpdates
}

class FakeCrashReporter : CrashReporter {
    val logs = mutableListOf<String>()
    val nonFatals = mutableListOf<Throwable>()
    var userId: String? = null
        private set

    override fun log(message: String) {
        logs += message
    }

    override fun recordNonFatal(throwable: Throwable) {
        nonFatals += throwable
    }

    override fun setUserId(userId: String?) {
        this.userId = userId
    }
}

class FakeAppInstanceIdProvider(var id: String? = DEFAULT_APP_INSTANCE_ID) : AppInstanceIdProvider {
    override suspend fun appInstanceId(): String? = id

    companion object {
        const val DEFAULT_APP_INSTANCE_ID = "fake-app-instance"
    }
}
