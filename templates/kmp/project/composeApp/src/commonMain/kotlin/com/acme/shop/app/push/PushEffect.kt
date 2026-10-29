package com.acme.shop.app.push

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.acme.shop.app.deeplink.DeepLinkStore
import com.acme.shop.core.notification.composable.rememberNotificationManager
import com.acme.shop.core.notification.model.NotificationStyle
import com.acme.shop.core.notification.push.PushSignals

/**
 * Foreground pushes become an in-app banner; a tapped system push that carries a link the app handles is published to
 * the [DeepLinkStore]. Also reports the app's foreground state to the platform push services.
 */
@Composable
fun PushEffect(deepLinks: DeepLinkStore) {
    val notifications = rememberNotificationManager()
    LifecycleResumeEffect(Unit) {
        PushSignals.setAppForeground(true)
        onPauseOrDispose { PushSignals.setAppForeground(false) }
    }
    LaunchedEffect(Unit) {
        PushSignals.messages.collect { push -> notifications.show(push.message, style = NotificationStyle.Info, title = push.title) }
    }
    val tap by PushSignals.tap.collectAsStateWithLifecycle()
    LaunchedEffect(tap) {
        val current = tap ?: return@LaunchedEffect
        PushSignals.consumeTap(current)
        current.deepLink?.let(deepLinks::publish)
    }
}
