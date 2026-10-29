package com.acme.shop.core.analytics

/**
 * Limits every backend must respect (they are Firebase Analytics' limits, the strictest vendor we target):
 * snake_case names of at most 40 characters, at most 25 parameters, string values of at most 100 characters.
 */
object AnalyticsLimits {
    const val MAX_NAME_LENGTH = 40
    const val MAX_PARAM_KEY_LENGTH = 40
    const val MAX_PARAM_VALUE_LENGTH = 100
    const val MAX_PARAMS = 25
    val NAME_PATTERN = Regex("^[a-z][a-z0-9_]*$")
}

/** Why an event cannot be sent as written. */
sealed interface AnalyticsIssue {
    data class InvalidName(val name: String) : AnalyticsIssue
    data class InvalidParamKey(val key: String) : AnalyticsIssue
    data class TooManyParams(val count: Int) : AnalyticsIssue
}

object AnalyticsValidation {

    fun isValidName(name: String): Boolean =
        name.length in 1..AnalyticsLimits.MAX_NAME_LENGTH && AnalyticsLimits.NAME_PATTERN.matches(name)

    fun isValidParamKey(key: String): Boolean =
        key.length in 1..AnalyticsLimits.MAX_PARAM_KEY_LENGTH && AnalyticsLimits.NAME_PATTERN.matches(key)

    /** Problems that make the event unsendable; an empty list means the event only needs [sanitized]. */
    fun issues(event: AnalyticsEvent): List<AnalyticsIssue> = buildList {
        if (!isValidName(event.name)) add(AnalyticsIssue.InvalidName(event.name))
        event.params.keys.filterNot(::isValidParamKey).forEach { add(AnalyticsIssue.InvalidParamKey(it)) }
        if (event.params.size > AnalyticsLimits.MAX_PARAMS) add(AnalyticsIssue.TooManyParams(event.params.size))
    }

    /** Truncates over-long text values; structure problems are reported by [issues], not fixed silently. */
    fun sanitized(event: AnalyticsEvent): AnalyticsEvent = event.copy(
        params = event.params.mapValues { (_, value) ->
            if (value is AnalyticsValue.Text && value.value.length > AnalyticsLimits.MAX_PARAM_VALUE_LENGTH) {
                AnalyticsValue.Text(value.value.take(AnalyticsLimits.MAX_PARAM_VALUE_LENGTH))
            } else {
                value
            }
        },
    )
}
