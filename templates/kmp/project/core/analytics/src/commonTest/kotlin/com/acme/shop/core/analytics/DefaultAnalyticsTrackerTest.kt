package com.acme.shop.core.analytics

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

private const val GRACE_MS = 50L

private val CONTEXT = AnalyticsContext(
    userType = AnalyticsUserType.GUEST,
    language = "ar",
    appVersion = "1.0",
    platform = "android",
    environment = "dev",
)

@OptIn(ExperimentalCoroutinesApi::class)
class DefaultAnalyticsTrackerTest {

    private val backend = RecordingAnalyticsBackend()
    private val reported = mutableListOf<Pair<AnalyticsEvent, List<AnalyticsIssue>>>()

    private fun tracker(scope: kotlinx.coroutines.CoroutineScope, context: AnalyticsContext = CONTEXT) =
        DefaultAnalyticsTracker(backend, { context }, scope) { event, issues -> reported += event to issues }

    @Test
    fun screenViewCarriesScreenNameAndCommonFields() = runTest(UnconfinedTestDispatcher()) {
        tracker(this).trackScreen(AnalyticsScreen("item_details", analyticsParams { text(AnalyticsKeys.ITEM_ID, "i1") }))
        val event = backend.events.single()
        assertEquals(AnalyticsEventNames.SCREEN_VIEW, event.name)
        assertEquals(AnalyticsValue.Text("item_details"), event.params[AnalyticsKeys.SCREEN_NAME])
        assertEquals(AnalyticsValue.Text("i1"), event.params[AnalyticsKeys.ITEM_ID])
        assertEquals(AnalyticsValue.Text("guest"), event.params[AnalyticsKeys.USER_TYPE])
        assertEquals(AnalyticsValue.Text("ar"), event.params[AnalyticsKeys.LANGUAGE])
        assertEquals(AnalyticsValue.Text("1.0"), event.params[AnalyticsKeys.APP_VERSION])
        assertEquals(AnalyticsValue.Text("android"), event.params[AnalyticsKeys.PLATFORM])
        assertEquals(AnalyticsValue.Text("dev"), event.params[AnalyticsKeys.ENVIRONMENT])
    }

    @Test
    fun eventParamsWinOverContextParams() = runTest(UnconfinedTestDispatcher()) {
        tracker(this).trackAction(AnalyticsAction("language_switch", analyticsParams { text(AnalyticsKeys.LANGUAGE, "en") }))
        assertEquals(AnalyticsValue.Text("en"), backend.events.single().params[AnalyticsKeys.LANGUAGE])
    }

    @Test
    fun invalidEventsAreReportedNotSent() = runTest(UnconfinedTestDispatcher()) {
        tracker(this).trackAction(AnalyticsAction("Bad Name"))
        assertTrue(backend.events.isEmpty())
        assertEquals("Bad Name", reported.single().first.name)
        assertEquals(listOf(AnalyticsIssue.InvalidName("Bad Name")), reported.single().second)
    }

    @Test
    fun longTextValuesAreTruncatedBeforeSending() = runTest(UnconfinedTestDispatcher()) {
        val long = "q".repeat(AnalyticsLimits.MAX_PARAM_VALUE_LENGTH * 2)
        tracker(this).trackAction(AnalyticsAction("search_query", analyticsParams { text("query", long) }))
        val sent = backend.events.single().params["query"] as AnalyticsValue.Text
        assertEquals(AnalyticsLimits.MAX_PARAM_VALUE_LENGTH, sent.value.length)
    }

    @Test
    fun userIdAndPropertiesReachTheBackend() = runTest(UnconfinedTestDispatcher()) {
        val tracker = tracker(this)
        tracker.setUserId("customer-1")
        tracker.setUserProperty("segment", "group_b")
        assertEquals("customer-1", backend.userId)
        assertEquals(mapOf("segment" to "group_b"), backend.userProperties)
        tracker.setUserId(null)
        assertNull(backend.userId)
    }

    @Test
    fun actionsCarryTheCurrentScreen() = runTest(UnconfinedTestDispatcher()) {
        val tracker = tracker(this)
        tracker.trackAction(AnalyticsAction("onboarding_skip"))
        assertNull(backend.events.single().params[AnalyticsKeys.SCREEN_NAME])
        tracker.trackScreen(AnalyticsScreen("home"))
        tracker.trackAction(AnalyticsAction("banner_click"))
        assertEquals(AnalyticsValue.Text("home"), backend.events.last().params[AnalyticsKeys.SCREEN_NAME])
        tracker.trackAction(AnalyticsAction("segment_tab_switch", analyticsParams { text(AnalyticsKeys.SCREEN_NAME, "other") }))
        assertEquals(AnalyticsValue.Text("other"), backend.events.last().params[AnalyticsKeys.SCREEN_NAME])
    }

    @Test
    fun routeViewIsSentUnlessTheScreenReportsItselfFirst() = runTest {
        val tracker = DefaultAnalyticsTracker(backend, { CONTEXT }, backgroundScope, routeViewGraceMs = GRACE_MS)
        tracker.trackRoute("route.Screen.Bookmarks")
        testScheduler.advanceTimeBy(GRACE_MS + 1)
        testScheduler.runCurrent()
        assertEquals(AnalyticsValue.Text("bookmarks"), backend.events.single().params[AnalyticsKeys.SCREEN_NAME])

        tracker.trackRoute("route.Screen.ItemDetails/{itemId}")
        tracker.trackScreen(AnalyticsScreen("item_details", analyticsParams { text(AnalyticsKeys.ITEM_ID, "i1") }))
        testScheduler.advanceTimeBy(GRACE_MS + 1)
        testScheduler.runCurrent()
        assertEquals(2, backend.events.size)
        assertEquals(AnalyticsValue.Text("i1"), backend.events.last().params[AnalyticsKeys.ITEM_ID])

        tracker.trackRoute(null)
        tracker.trackAction(AnalyticsAction("item_share"))
        testScheduler.runCurrent()
        assertEquals(AnalyticsValue.Text("item_details"), backend.events.last().params[AnalyticsKeys.SCREEN_NAME])
    }

    @Test
    fun compositeBackendFansOut() = runTest(UnconfinedTestDispatcher()) {
        val second = RecordingAnalyticsBackend()
        val composite = CompositeAnalyticsBackend(listOf(backend, second))
        DefaultAnalyticsTracker(composite, { CONTEXT }, this).trackAction(AnalyticsAction("banner_click"))
        assertEquals(1, backend.events.size)
        assertEquals(1, second.events.size)
        backend.clear()
        assertTrue(backend.events.isEmpty())
    }
}
