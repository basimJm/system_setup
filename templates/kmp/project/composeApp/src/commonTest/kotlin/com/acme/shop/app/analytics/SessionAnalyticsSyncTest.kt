package com.acme.shop.app.analytics

import com.acme.shop.core.analytics.AnalyticsAction
import com.acme.shop.core.analytics.AnalyticsKeys
import com.acme.shop.core.analytics.AnalyticsScreen
import com.acme.shop.core.analytics.AnalyticsTracker
import com.acme.shop.core.domain.session.SessionState
import com.acme.shop.core.domain.session.UserProfile
import com.acme.shop.core.firebase.FakeCrashReporter
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

private class RecordingTracker : AnalyticsTracker {
    var lastUserId: String? = null
    val properties = LinkedHashMap<String, String?>()
    override fun trackScreen(screen: AnalyticsScreen) = Unit
    override fun trackAction(action: AnalyticsAction) = Unit
    override fun trackRoute(route: String?) = Unit
    override fun setUserId(userId: String?) {
        lastUserId = userId
    }

    override fun setUserProperty(key: String, value: String?) {
        properties[key] = value
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class SessionAnalyticsSyncTest {

    private val session = MutableStateFlow<SessionState>(SessionState.Guest)
    private val tracker = RecordingTracker()
    private val crashReporter = FakeCrashReporter()

    @Test
    fun userIdFollowsLoginAndLogoutOnAnalyticsAndCrashReports() = runTest(UnconfinedTestDispatcher()) {
        val job = SessionAnalyticsSync(session, tracker, crashReporter).start(backgroundScope)
        assertNull(tracker.lastUserId)
        assertEquals("guest", tracker.properties[AnalyticsKeys.USER_TYPE])

        session.value = SessionState.SignedIn(UserProfile(id = "c1", firstName = "Omar"))
        assertEquals("c1", tracker.lastUserId)
        assertEquals("c1", crashReporter.userId)
        assertEquals("registered", tracker.properties[AnalyticsKeys.USER_TYPE])

        session.value = SessionState.Guest
        assertNull(tracker.lastUserId)
        assertNull(crashReporter.userId)
        job.cancel()
    }
}
