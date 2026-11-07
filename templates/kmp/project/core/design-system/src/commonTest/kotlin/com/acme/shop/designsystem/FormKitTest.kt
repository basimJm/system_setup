package com.acme.shop.designsystem

import com.acme.shop.designsystem.components.form.CountryUi
import com.acme.shop.designsystem.components.form.filterCountries
import kotlin.test.Test
import kotlin.test.assertEquals

private val SAMPLE_A = CountryUi("XA", "Country A", "+991", null, "^7[789][0-9]{7}$")
private val SAMPLE_B = CountryUi("XB", "بلد ب", "+992", null, "^5[0-9]{8}$")
private val EGYPT = CountryUi("EG", "Egypt", "+20", null, "^1[0-9]{9}$")
private val ALL = listOf(SAMPLE_A, SAMPLE_B, EGYPT)

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
        assertEquals(listOf(SAMPLE_B), filterCountries(ALL, "بلد ب"))
    }

    @Test
    fun matchesByDialCodePrefixWithOrWithoutPlus() {
        assertEquals(listOf(SAMPLE_A, SAMPLE_B), filterCountries(ALL, "99"))
        assertEquals(listOf(SAMPLE_A), filterCountries(ALL, "+991"))
        assertEquals(listOf(EGYPT), filterCountries(ALL, "2"))
        assertEquals(emptyList(), filterCountries(ALL, "+1"))
    }
}
