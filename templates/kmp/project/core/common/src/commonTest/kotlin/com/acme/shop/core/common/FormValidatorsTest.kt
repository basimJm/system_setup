package com.acme.shop.core.common

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

private const val JORDAN_MOBILE = "^7[789][0-9]{7}$"

class FormValidatorsTest {

    @Test
    fun normalizeStripsFormattingAndTheTrunkZero() {
        assertEquals("791234567", FormValidators.normalizeNationalNumber("079 123-4567"))
        assertEquals("791234567", FormValidators.normalizeNationalNumber("(079) 123.4567"))
        assertEquals("791234567", FormValidators.normalizeNationalNumber("791234567"))
        assertEquals("0", FormValidators.normalizeNationalNumber("0"))
        assertEquals("", FormValidators.normalizeNationalNumber("  "))
    }

    @Test
    fun phoneMatchesTheServerRegexAfterNormalization() {
        assertTrue(FormValidators.isValidPhone("0791234567", JORDAN_MOBILE))
        assertTrue(FormValidators.isValidPhone("79 123 4567", JORDAN_MOBILE))
        assertFalse(FormValidators.isValidPhone("0691234567", JORDAN_MOBILE))
        assertFalse(FormValidators.isValidPhone("79123", JORDAN_MOBILE))
        assertFalse(FormValidators.isValidPhone("", JORDAN_MOBILE))
        assertFalse(FormValidators.isValidPhone("79abc4567", JORDAN_MOBILE))
    }

    @Test
    fun malformedServerRegexFailsClosed() {
        assertFalse(FormValidators.isValidPhone("0791234567", "^7[78"))
    }

    @Test
    fun requiredTextIgnoresWhitespace() {
        assertTrue(FormValidators.isRequiredText(" Sara "))
        assertFalse(FormValidators.isRequiredText("   "))
        assertFalse(FormValidators.isRequiredText(""))
    }

    @Test
    fun emailIsTrimmedBeforeValidation() {
        assertTrue(FormValidators.isValidEmail("  sara@example.com "))
        assertFalse(FormValidators.isValidEmail("sara@"))
    }

    @Test
    fun otpNeedsExactlyTheBackendLengthOfDigits() {
        assertTrue(FormValidators.isValidOtp("123456", otpLength = 6))
        assertFalse(FormValidators.isValidOtp("12345", otpLength = 6))
        assertFalse(FormValidators.isValidOtp("12345a", otpLength = 6))
        assertTrue(FormValidators.isValidOtp("1234", otpLength = 4))
        assertFalse(FormValidators.isValidOtp("", otpLength = 0))
    }
}
