package com.acme.shop.core.common

/**
 * Field rules of , platform-free so ViewModels and tests share them.
 * Messages are not here: the presentation layer maps a failed rule to a localized string resource.
 */
object FormValidators {

    /** Spaces, dashes, dots and parentheses users type into phone fields. */
    private val PHONE_NOISE = Regex("[\\s\\-().]")
    private const val NATIONAL_TRUNK_PREFIX = '0'

    /** `079 123-4567` -> `791234567`: the national number without formatting and without the leading trunk zero. */
    fun normalizeNationalNumber(raw: String): String {
        val digits = raw.replace(PHONE_NOISE, "")
        return if (digits.length > 1 && digits.first() == NATIONAL_TRUNK_PREFIX) digits.drop(1) else digits
    }

    /**
     * The server sends one regex per country, tested against the national number without the leading 0
     * (`openapi.customer.json`). A malformed regex is a server defect and must never crash the app: it fails closed.
     */
    fun isValidPhone(raw: String, serverRegex: String): Boolean {
        val national = normalizeNationalNumber(raw)
        if (national.isEmpty() || !national.all { it.isDigit() }) return false
        val regex = runCatching { Regex(serverRegex) }.getOrNull() ?: return false
        return regex.matches(national)
    }

    fun isRequiredText(value: String): Boolean = value.isNotBlank()

    fun isValidEmail(value: String): Boolean = StrValidator().isValidEmail(value.trim())

    /** Exactly [otpLength] digits; the length always comes from the backend. */
    fun isValidOtp(code: String, otpLength: Int): Boolean =
        otpLength > 0 && code.length == otpLength && code.all { it.isDigit() }
}
