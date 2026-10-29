package com.acme.shop.app.push

import com.acme.shop.core.common.DeepLinks
import com.acme.shop.core.notification.push.PushNotification

/** Where a tapped system push lands: a items link, for registered users, Home for guests. */
sealed interface PushTapDestination {
    data class Link(val url: String) : PushTapDestination
    data object Notifications : PushTapDestination
    data object Home : PushTapDestination
}

fun pushTapDestinationOf(notification: PushNotification, signedIn: Boolean, webBaseUrl: String): PushTapDestination {
    val link = notification.deepLink?.takeIf { DeepLinks.parse(it, webBaseUrl) != null }
    return when {
        link != null -> PushTapDestination.Link(link)
        signedIn -> PushTapDestination.Notifications
        else -> PushTapDestination.Home
    }
}
