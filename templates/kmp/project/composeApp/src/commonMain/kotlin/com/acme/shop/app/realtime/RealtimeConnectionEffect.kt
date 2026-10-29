package com.acme.shop.app.realtime

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.lifecycle.compose.LifecycleResumeEffect
import com.acme.shop.core.realtime.RealtimeClient

/**
 * a registered customer keeps the authenticated socket while the app is in the foreground. Resumed and
 * signed in → connect (also when the session signs in while resumed); paused, signed out or disposed → disconnect.
 */
@Composable
fun RealtimeConnectionEffect(
    client: RealtimeClient,
    isSignedIn: Boolean,
) {
    val currentClient by rememberUpdatedState(client)
    LifecycleResumeEffect(isSignedIn) {
        if (isSignedIn) currentClient.connect() else currentClient.disconnect()
        onPauseOrDispose { currentClient.disconnect() }
    }
}

/** Pure rule behind the effect, so the decision is testable without a lifecycle. */
fun shouldHoldRealtimeConnection(isResumed: Boolean, isSignedIn: Boolean): Boolean = isResumed && isSignedIn
