package com.acme.shop.app.deeplink

import com.acme.shop.core.common.AppEnvironment
import com.acme.shop.core.common.DeepLink
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class DeepLinkStoreTest {
    private val store = DeepLinkStore(AppEnvironment("dev", "https://api.example", "https://web.example", "1.0.0", 1, isDebug = true))

    @Test
    fun keepsOnlyLinksOfThePlatformHostUntilConsumed() {
        assertFalse(store.publish("https://other.example/items/i1"))
        assertFalse(store.publish(null))
        assertNull(store.link.value)
        assertTrue(store.publish("https://web.example/items/i1"))
        assertEquals(DeepLink(listOf("items", "i1")), store.link.value)
        store.consume(DeepLink(listOf("other")))
        assertEquals(DeepLink(listOf("items", "i1")), store.link.value, "consuming a different link keeps the pending one")
        store.consume(DeepLink(listOf("items", "i1")))
        assertNull(store.link.value)
    }
}
