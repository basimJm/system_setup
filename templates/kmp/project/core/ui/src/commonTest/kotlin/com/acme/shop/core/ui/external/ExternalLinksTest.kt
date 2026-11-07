package com.acme.shop.core.ui.external

import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ExternalLinksTest {
    @Test
    fun whatsAppLinkStripsEverythingButDigits() {
        assertEquals("https://wa.me/991791234567", ExternalLinks.whatsApp("+991 79 123 4567"))
        assertEquals("https://wa.me/991791234567", ExternalLinks.whatsApp("(+991) 79-123-4567"))
    }

    @Test
    fun telLinkKeepsOnlyALeadingPlusAndDigits() {
        assertEquals("tel:+991791234567", ExternalLinks.tel(" +991791234567 "))
        assertEquals("tel:+991791234567", ExternalLinks.tel("+991 (79) 123-4567"))
        assertEquals("tel:0791234567", ExternalLinks.tel("079 123 4567"))
        assertEquals("+99165000100", ExternalLinks.dialable("+991 6 500 0100"))
        assertEquals("991", ExternalLinks.dialable("9+91"), "a plus inside the number is dropped")
    }

    @Test
    fun mapsLinksCarryTheCoordinatesAndAnEncodedLabel() {
        assertEquals("geo:31.95,35.91?q=31.95,35.91(Glow%20%26%20Co)", MapLinks.geo(31.95, 35.91, "Glow & Co"))
        assertEquals("https://google.com/maps/search/?api=1&query=31.95,35.91", MapLinks.googleMapsWeb(31.95, 35.91))
        assertEquals("comgooglemaps://?q=31.95,35.91", MapLinks.googleMapsApp(31.95, 35.91))
        assertEquals("comgooglemaps://", MapLinks.googleMapsAppProbe())
        assertEquals("https://maps.apple.com/?ll=31.95,35.91&q=%D8%B5", MapLinks.appleMaps(31.95, 35.91, "ص"))
        assertEquals("mailto:help@example.com", ExternalLinks.mailto(" help@example.com "))
    }

    @Test
    fun queryEncodingKeepsUnreservedAndEncodesUtf8() {
        assertEquals("Glow%20Store%20%26%20Spa", ExternalLinks.queryEncode("Glow Store & Spa"))
        assertEquals("%D8%B5%D8%A7%D9%84%D9%88%D9%86", ExternalLinks.queryEncode("صالون"))
        assertEquals("a-b_c.d~e", ExternalLinks.queryEncode("a-b_c.d~e"))
    }

    @Test
    fun outcomeNamesTheMissingAppAndTheFakeRecordsEveryCall() = runTest {
        val fake = FakeExternalActions(unavailable = setOf(ExternalApp.DIALER))
        assertEquals(ExternalApp.DIALER, fake.dial("+991 79").unavailableApp)
        assertNull(fake.openWhatsApp("+991 79").unavailableApp)
        assertNull(ExternalOutcome.Opened.unavailableApp)
        assertEquals(listOf("tel:+99179", "https://wa.me/99179"), fake.calls)
    }
}
