package com.acme.shop.core.analytics.compose

import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.lifecycle.compose.LifecycleResumeEffect
import com.acme.shop.core.analytics.AnalyticsScreen
import com.acme.shop.core.analytics.AnalyticsTracker
import com.acme.shop.core.analytics.NoOpAnalyticsTracker

/** Provided once by the app shell; previews and tests fall back to the no-op tracker. */
val LocalAnalyticsTracker = staticCompositionLocalOf<AnalyticsTracker> { NoOpAnalyticsTracker }

/**
 * Reports a `screen_view` every time the screen becomes visible (first composition and every resume),
 * which is what "every screen view" in means. Call it once at the top of each screen composable.
 */
@Composable
fun TrackScreen(
    screen: AnalyticsScreen,
    tracker: AnalyticsTracker = LocalAnalyticsTracker.current,
) {
    LifecycleResumeEffect(screen, tracker) {
        tracker.trackScreen(screen)
        onPauseOrDispose { }
    }
}
