package com.acme.shop.core.common

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class DeepLinksTest {
    @Test
    fun buildsLinksWithoutDoubleSlashes() {
        assertEquals("https://example.invalid/items/i1", DeepLinks.of("https://example.invalid/", "items", " i1 "))
        assertEquals("https://example.invalid/items/i1", DeepLinks.of("https://example.invalid", "/items/", "i1"))
        assertEquals("example.invalid", DeepLinks.host("https://example.invalid/"))
    }

    @Test
    fun parsesPathSegmentsOfTheAppHostOnly() {
        val parsed = DeepLinks.parse("https://Example.invalid/items/i1?utm=x#top", "https://example.invalid")
        assertEquals(DeepLink(listOf("items", "i1")), parsed)
        assertEquals("items", DeepLinks.parse("https://any.host/items/i1")?.first)
        assertNull(DeepLinks.parse("https://other.invalid/items/i1", "https://example.invalid"))
        assertNull(DeepLinks.parse("https://example.invalid/", "https://example.invalid"))
        assertNull(DeepLinks.parse("not a url"))
    }
}
