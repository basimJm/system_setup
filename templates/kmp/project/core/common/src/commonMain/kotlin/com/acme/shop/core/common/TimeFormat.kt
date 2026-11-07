@file:Suppress("DEPRECATION") // kotlinx.datetime.Instant is a deprecated typealias on the K/N classpath until the datetime upgrade

package com.acme.shop.core.common

import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

/** 12-hour display of the server's "HH:mm" times (root CLAUDE.md: display 12-hour); labels come from resources. */
object TimeFormat {
    private const val HOURS_IN_HALF_DAY = 12
    private const val HOURS_IN_DAY = 24
    private const val MINUTES_IN_HOUR = 60
    private const val MINUTE_DIGITS = 2
    private const val TIME_PARTS = 2
    private const val SEPARATOR = ':'
    private const val PAD = '0'
    private const val INVALID = -1
    private const val ISO_DATE_LENGTH = 10
    private const val DATE_PARTS = 3
    private const val DATE_SEPARATOR = '-'
    private const val DISPLAY_DATE_SEPARATOR = "/"

    /** "16:05" → "4:05 PM"; null when the input is not a valid "HH:mm" (fixtures, bad data) so callers can hide it. */
    fun to12Hour(hhmm: String, am: String, pm: String): String? {
        val parts = hhmm.trim().split(SEPARATOR)
        val hour = parts.getOrNull(0)?.toIntOrNull() ?: INVALID
        val minute = parts.getOrNull(1)?.toIntOrNull() ?: INVALID
        val valid = parts.size == TIME_PARTS && hour in 0 until HOURS_IN_DAY && minute in 0 until MINUTES_IN_HOUR
        if (!valid) return null
        val label = if (hour < HOURS_IN_HALF_DAY) am else pm
        val shown = (hour % HOURS_IN_HALF_DAY).let { if (it == 0) HOURS_IN_HALF_DAY else it }
        return "$shown$SEPARATOR${minute.toString().padStart(MINUTE_DIGITS, PAD)} $label"
    }

    /** ISO date or date-time ("2026-10-18T10:00:00Z") → "18/10/2026"; null when not ISO. */
    fun isoDateText(iso: String): String? {
        val date = iso.trim().take(ISO_DATE_LENGTH).split(DATE_SEPARATOR)
        if (date.size != DATE_PARTS || date.any { it.toIntOrNull() == null }) return null
        return date.reversed().joinToString(DISPLAY_DATE_SEPARATOR)
    }

    /** An ISO instant (stored UTC) shown in the business time zone: date "18/10/2026" and 12-hour time. */
    fun instantText(iso: String, am: String, pm: String, zoneId: String = BusinessTime.ZONE_ID): DateTimeText? {
        val instant = runCatching { Instant.parse(iso.trim()) }.getOrNull() ?: return null
        val local = instant.toLocalDateTime(if (zoneId == BusinessTime.ZONE_ID) BusinessTime.zone else TimeZone.of(zoneId))
        val date = local.date.toString().split(DATE_SEPARATOR).reversed().joinToString(DISPLAY_DATE_SEPARATOR)
        val hhmm = local.hour.toString().padStart(MINUTE_DIGITS, PAD) + SEPARATOR + local.minute.toString().padStart(MINUTE_DIGITS, PAD)
        return DateTimeText(date = date, time = to12Hour(hhmm, am, pm) ?: hhmm)
    }

    /** "8:00 AM – 4:00 PM"; null when either end is invalid. */
    fun range12Hour(open: String, close: String, am: String, pm: String, rangeSeparator: String): String? {
        val from = to12Hour(open, am, pm) ?: return null
        val to = to12Hour(close, am, pm) ?: return null
        return "$from$rangeSeparator$to"
    }
}

/** Root CLAUDE.md: UTC stored, Etc/GMT-3 computed, 12-hour displayed. */
object BusinessTime {
    /** Current instant as a kotlinx-datetime value (the platform clock behind `SystemClock`; Kotlin/Native safe). */
    fun nowInstant(): kotlinx.datetime.Instant = kotlinx.datetime.Instant.fromEpochMilliseconds(SystemClock.now().toEpochMilliseconds())

    const val ZONE_ID = "Etc/GMT-3"

    /** The business zone, loaded once. */
    val zone: TimeZone by lazy { TimeZone.of(ZONE_ID) }
}

data class DateTimeText(val date: String, val time: String)
