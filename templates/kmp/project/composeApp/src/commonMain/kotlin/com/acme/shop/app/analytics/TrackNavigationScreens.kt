package com.acme.shop.app.analytics

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.navigation.NavController
import com.acme.shop.core.analytics.AnalyticsTracker
import com.acme.shop.core.analytics.compose.LocalAnalyticsTracker

/** Reports every destination change of the host to the tracker, once per app shell. */
@Composable
fun TrackNavigationScreens(
    navController: NavController,
    tracker: AnalyticsTracker = LocalAnalyticsTracker.current,
) {
    val currentTracker by rememberUpdatedState(tracker)
    DisposableEffect(navController) {
        val listener = NavController.OnDestinationChangedListener { _, destination, _ ->
            currentTracker.trackRoute(destination.route)
        }
        navController.addOnDestinationChangedListener(listener)
        onDispose { navController.removeOnDestinationChangedListener(listener) }
    }
}
