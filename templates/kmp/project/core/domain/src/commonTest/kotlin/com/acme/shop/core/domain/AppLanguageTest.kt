package com.acme.shop.core.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AppLanguageTest {
    @Test
    fun arabicIsTheDefaultAndRightToLeft() {
        assertEquals(AppLanguage.ARABIC, AppLanguage.DEFAULT)
        assertTrue(AppLanguage.ARABIC.isRtl)
        assertFalse(AppLanguage.ENGLISH.isRtl)
    }

    @Test
    fun codesAndPlatformLocaleTagsResolveToTheirLanguage() {
        listOf("ar", "AR", "ar_EG", "ar-EG", " ar ").forEach { assertEquals(AppLanguage.ARABIC, AppLanguage.fromCode(it), it) }
        listOf("en", "EN", "en_US", "en-GB").forEach { assertEquals(AppLanguage.ENGLISH, AppLanguage.fromCode(it), it) }
    }

    @Test
    fun unknownBlankOrMissingCodesFallBackToArabic() {
        listOf(null, "", "  ", "fr", "xx_YY", "_", "arabic").forEach {
            assertEquals(AppLanguage.ARABIC, AppLanguage.fromCode(it), it.toString())
        }
    }

    @Test
    fun otherSwitchesBetweenTheTwoLanguages() {
        assertEquals(AppLanguage.ENGLISH, AppLanguage.ARABIC.other)
        assertEquals(AppLanguage.ARABIC, AppLanguage.ENGLISH.other)
    }

    @Test
    fun everyLanguageRoundTripsThroughItsCode() {
        AppLanguage.entries.forEach { assertEquals(it, AppLanguage.fromCode(it.code)) }
    }
}
