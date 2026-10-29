package com.acme.shop.core.common

/**
 * Interface for providing access to localized strings from ViewModels.
 * Implementations should provide localized strings based on the current app language.
 */
interface StringProvider {
    /**
     * Gets a localized string by its key.
     * @param key The string resource key
     * @param args Optional format arguments
     * @return The localized string
     */
    fun getString(key: String, vararg args: Any): String

    /**
     * Gets a localized string by its key, with a default fallback.
     */
    fun getString(key: String, defaultValue: String, vararg args: Any): String
    
    /**
     * Gets a list of localized month names (January-December).
     */
    fun getMonthNames(): List<String>
    
    /**
     * Gets time-related strings for formatting.
     */
    fun getTimeAgoStrings(): TimeAgoStrings
}

/**
 * Data class holding time-related localized strings.
 */
data class TimeAgoStrings(
    val justNow: String,
    val minutesAgo: String,  // Should contain %1$d placeholder
    val hoursAgo: String,     // Should contain %1$d placeholder
    val yesterday: String,
    val daysAgo: String,      // Should contain %1$d placeholder
    val dateAt: String,
    val timeAm: String,
    val timePm: String
)
