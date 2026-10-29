package com.acme.shop.designsystem

import com.acme.shop.designsystem.components.textfield.DatePickerDates
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class DatePickerDatesTest {

    @Test
    fun isoAndMillisRoundTrip() {
        val millis = DatePickerDates.isoToMillis("2026-10-20")
        assertEquals(1_792_454_400_000L, millis)
        assertEquals("2026-10-20", DatePickerDates.millisToIso(millis!!))
    }

    @Test
    fun epochAndLeapDay() {
        assertEquals("1970-01-01", DatePickerDates.millisToIso(0L))
        assertEquals("2028-02-29", DatePickerDates.millisToIso(DatePickerDates.isoToMillis("2028-02-29")!!))
    }

    @Test
    fun blankOrMalformedOpensOnToday() {
        assertNull(DatePickerDates.isoToMillis(""))
        assertNull(DatePickerDates.isoToMillis("20/10/2026"))
    }

    @Test
    fun displayIsDayMonthYear() {
        assertEquals("05/03/2026", DatePickerDates.display("2026-03-05"))
        assertEquals("", DatePickerDates.display(""))
    }
}
