package com.acme.shop.app.push

import com.acme.shop.core.notification.push.PushKeys
import com.acme.shop.core.notification.push.PushNotification
import com.acme.shop.core.notification.push.pushNotificationOf
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class PushRoutingTest {
    private val web = "https://web.example"

    @Test
    fun tapRoutesToTheItemLinkThenNotificationsThenHome() {
        val plain = PushNotification("t", "b")
        assertEquals(PushTapDestination.Notifications, pushTapDestinationOf(plain, signedIn = true, webBaseUrl = web))
        assertEquals(PushTapDestination.Home, pushTapDestinationOf(plain, signedIn = false, webBaseUrl = web))
        val linked = PushNotification("t", "b", deepLink = "https://web.example/item/s1")
        assertEquals(
            PushTapDestination.Link("https://web.example/item/s1"),
            pushTapDestinationOf(linked, signedIn = false, webBaseUrl = web),
        )
        val foreign = PushNotification("t", "b", deepLink = "https://evil.example/item/s1")
        assertEquals(PushTapDestination.Notifications, pushTapDestinationOf(foreign, signedIn = true, webBaseUrl = web))
    }

    @Test
    fun payloadBuildsFromNotificationFieldsOrDataAndDropsEmptyOnes() {
        val fromData = pushNotificationOf(mapOf(PushKeys.TITLE to "Hi", PushKeys.BODY to "There", PushKeys.DEEP_LINK to " "))
        assertEquals(
            PushNotification("Hi", "There", mapOf(PushKeys.TITLE to "Hi", PushKeys.BODY to "There", PushKeys.DEEP_LINK to " ")),
            fromData,
        )
        val shown = pushNotificationOf(mapOf(PushKeys.NOTIFICATION_ID to "n1"), title = "Approved", body = "See details")
        assertEquals("Approved", shown?.title)
        assertEquals("n1", shown?.data?.get(PushKeys.NOTIFICATION_ID))
        assertNull(pushNotificationOf(emptyMap()))
    }
}
