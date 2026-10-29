package com.acme.shop.designsystem.components.textfield

import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.LocalDate
import kotlinx.datetime.plus

/** Pure conversions between the ISO dates screens store (`yyyy-MM-dd`) and the UTC-midnight millis of the date picker. */
object DatePickerDates {
    private const val MILLIS_PER_DAY = 86_400_000L
    private const val PAD = 2
    private val EPOCH = LocalDate.fromEpochDays(0)

    /** `null` for blank or malformed input, so the picker opens on today. */
    fun isoToMillis(iso: String): Long? =
        runCatching { LocalDate.parse(iso.trim()).toEpochDays() * MILLIS_PER_DAY }.getOrNull()

    fun millisToIso(millis: Long): String = EPOCH.plus(millis.floorDiv(MILLIS_PER_DAY), DateTimeUnit.DAY).toString()

    /** Field text: `dd/MM/yyyy` (digits read the same in AR and EN); the raw text when it is not an ISO date. */
    fun display(iso: String): String {
        val date = runCatching { LocalDate.parse(iso.trim()) }.getOrNull() ?: return iso
        val day = date.day.toString().padStart(PAD, '0')
        val month = date.month.ordinal.plus(1).toString().padStart(PAD, '0')
        return "$day/$month/${date.year}"
    }
}
