package com.acme.shop.designsystem.components.navigation

import androidx.compose.runtime.Composable
import androidx.navigationevent.NavigationEventInfo
import androidx.navigationevent.compose.NavigationBackHandler
import androidx.navigationevent.compose.rememberNavigationEventState

/**
 * System Back (Android back button / gesture, iOS edge swipe) routed to the screen, for screens with inner steps that
 * Back must walk through before leaving. While [enabled], the navigation
 * stack is not popped; [onBack] decides.
 */
@Composable
fun AppBackHandler(enabled: Boolean = true, onBack: () -> Unit) {
    NavigationBackHandler(
        state = rememberNavigationEventState(currentInfo = NavigationEventInfo.None),
        isBackEnabled = enabled,
        onBackCompleted = onBack,
    )
}
