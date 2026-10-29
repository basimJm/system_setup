package com.acme.shop.core.firebase

import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals

class FirebaseFacadeTest {

    @Test
    fun pushTokenRelayReplaysTheLatestToken() = runTest {
        PushTokenRelay.publish("token-1")
        PushTokenRelay.publish("token-2")
        assertEquals("token-2", FakePushTokenProvider().tokenUpdates.first())
        assertEquals("stored", FakePushTokenProvider("stored").currentToken())
    }

    @Test
    fun fakeAppInstanceIdIsScriptable() = runTest {
        val provider = FakeAppInstanceIdProvider()
        assertEquals(FakeAppInstanceIdProvider.DEFAULT_APP_INSTANCE_ID, provider.appInstanceId())
        provider.id = null
        assertEquals(null, provider.appInstanceId())
    }

    @Test
    fun fakeCrashReporterKeepsEverything() {
        val reporter = FakeCrashReporter()
        reporter.log("opened item")
        reporter.recordNonFatal(IllegalStateException("x"))
        reporter.setUserId("c1")
        assertEquals(listOf("opened item"), reporter.logs)
        assertEquals(1, reporter.nonFatals.size)
        assertEquals("c1", reporter.userId)
    }
}
