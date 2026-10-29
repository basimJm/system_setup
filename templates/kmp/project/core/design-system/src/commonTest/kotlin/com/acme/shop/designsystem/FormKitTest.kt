package com.acme.shop.designsystem

import com.acme.shop.designsystem.components.form.CountryUi
import com.acme.shop.designsystem.components.form.filterCountries
import kotlin.test.Test
import kotlin.test.assertEquals

private val JORDAN = CountryUi("JO", "الأردن", "+962", null, "^7[789][0-9]{7}$")
private val SAUDI = CountryUi("SA", "السعودية", "+966", null, "^5[0-9]{8}$")
private val EGYPT = CountryUi("EG", "Egypt", "+20", null, "^1[0-9]{9}$")
private val ALL = listOf(JORDAN, SAUDI, EGYPT)

class FormKitTest {

    @Test
    fun blankQueryKeepsEveryCountryInOrder() {
        assertEquals(ALL, filterCountries(ALL, ""))
        assertEquals(ALL, filterCountries(ALL, "   "))
    }

    @Test
    fun matchesByLocalizedNameIgnoringCase() {
        assertEquals(listOf(EGYPT), filterCountries(ALL, "egy"))
        assertEquals(listOf(EGYPT), filterCountries(ALL, "EGYPT"))
        assertEquals(listOf(SAUDI), filterCountries(ALL, "السعود"))
    }

    @Test
    fun matchesByDialCodePrefixWithOrWithoutPlus() {
        assertEquals(listOf(JORDAN, SAUDI), filterCountries(ALL, "96"))
        assertEquals(listOf(JORDAN), filterCountries(ALL, "+962"))
        assertEquals(listOf(EGYPT), filterCountries(ALL, "2"))
        assertEquals(emptyList(), filterCountries(ALL, "+1"))
    }
}
