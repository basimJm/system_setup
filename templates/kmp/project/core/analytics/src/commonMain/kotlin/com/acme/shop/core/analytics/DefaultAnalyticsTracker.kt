package com.acme.shop.core.analytics

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Receives events the tracker refused (invalid name or keys) so dev builds can surface programming errors. */
fun interface AnalyticsIssueReporter {
    fun report(event: AnalyticsEvent, issues: List<AnalyticsIssue>)
}

object NoOpAnalyticsIssueReporter : AnalyticsIssueReporter {
    override fun report(event: AnalyticsEvent, issues: List<AnalyticsIssue>) = Unit
}

/**
 * The one real [AnalyticsTracker]: turns screens and actions into events, merges the common context
 * (event parameters win over context parameters), validates, sanitizes and forwards to the backend on [scope].
 * Invalid events are reported, never sent, never thrown. Every action carries the current screen.
 *
 * Route views wait [routeViewGraceMs] so a screen that reports itself with ids on first composition replaces
 * the plain route view instead of doubling it.
 */
class DefaultAnalyticsTracker(
    private val backend: AnalyticsBackend,
    private val contextProvider: AnalyticsContextProvider,
    private val scope: CoroutineScope,
    private val routeViewGraceMs: Long = ROUTE_VIEW_GRACE_MS,
    private val issueReporter: AnalyticsIssueReporter = NoOpAnalyticsIssueReporter,
) : AnalyticsTracker {

    private var currentScreen: String? = null
    private var pendingRouteView: Job? = null

    override fun trackScreen(screen: AnalyticsScreen) {
        pendingRouteView?.cancel()
        currentScreen = screen.name
        send(AnalyticsEvent(AnalyticsEventNames.SCREEN_VIEW, screenParams(screen.name) + screen.params))
    }

    override fun trackRoute(route: String?) {
        val name = AnalyticsScreenNames.fromRoute(route) ?: return
        pendingRouteView?.cancel()
        currentScreen = name
        pendingRouteView = scope.launch {
            delay(routeViewGraceMs)
            send(AnalyticsEvent(AnalyticsEventNames.SCREEN_VIEW, screenParams(name)))
        }
    }

    override fun trackAction(action: AnalyticsAction) {
        val screen = currentScreen?.let(::screenParams).orEmpty()
        send(AnalyticsEvent(action.name, screen + action.params))
    }

    private fun screenParams(name: String): AnalyticsParams = analyticsParams { text(AnalyticsKeys.SCREEN_NAME, name) }

    override fun setUserId(userId: String?) {
        scope.launch { backend.setUserId(userId) }
    }

    override fun setUserProperty(key: String, value: String?) {
        scope.launch { backend.setUserProperty(key, value) }
    }

    private fun send(event: AnalyticsEvent) {
        scope.launch {
            val enriched = event.copy(params = contextProvider.current().toParams() + event.params)
            val issues = AnalyticsValidation.issues(enriched)
            if (issues.isEmpty()) {
                backend.logEvent(AnalyticsValidation.sanitized(enriched))
            } else {
                issueReporter.report(enriched, issues)
            }
        }
    }

    private companion object {
        /** One frame budget for the destination's composable to call `TrackScreen` with ids. */
        const val ROUTE_VIEW_GRACE_MS = 300L
    }
}
