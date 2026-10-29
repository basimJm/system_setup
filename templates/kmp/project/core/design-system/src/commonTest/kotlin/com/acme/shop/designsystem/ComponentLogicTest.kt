package com.acme.shop.designsystem

import com.acme.shop.designsystem.components.avatar.initialsOf
import com.acme.shop.designsystem.components.badge.countBadgeLabel
import com.acme.shop.designsystem.components.rating.starFill
import com.acme.shop.designsystem.components.stepper.StepState
import com.acme.shop.designsystem.components.stepper.stepState
import com.acme.shop.designsystem.components.textfield.sanitizeOtp
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ComponentLogicTest {
    @Test
    fun countBadgeHidesZeroAndCapsAtNinetyNine() {
        assertNull(countBadgeLabel(0))
        assertNull(countBadgeLabel(-3))
        assertEquals("1", countBadgeLabel(1))
        assertEquals("99", countBadgeLabel(99))
        assertEquals("99+", countBadgeLabel(100))
        assertEquals("99+", countBadgeLabel(12_345))
    }

    @Test
    fun starFillSupportsDecimalRatings() {
        assertEquals(1f, starFill(0, 4.5f))
        assertEquals(1f, starFill(3, 4.5f))
        assertEquals(0.5f, starFill(4, 4.5f))
        assertEquals(0f, starFill(4, 4f))
        assertEquals(0f, starFill(0, -2f))
        assertEquals(1f, starFill(4, 99f))
    }

    @Test
    fun stepStatesFollowTheCurrentStep() {
        assertEquals(StepState.Done, stepState(0, 2))
        assertEquals(StepState.Current, stepState(2, 2))
        assertEquals(StepState.Upcoming, stepState(3, 2))
    }

    @Test
    fun otpKeepsOnlyDigitsUpToTheBackendLength() {
        assertEquals("123456", sanitizeOtp("123456789", 6))
        assertEquals("12", sanitizeOtp("1a2b", 6))
        assertEquals("", sanitizeOtp("abc", 6))
        assertEquals("1234", sanitizeOtp("1234", 4))
        assertEquals("", sanitizeOtp("١٢٣", 6))
    }

    @Test
    fun initialsUseTheFirstLettersOfAtMostTwoWords() {
        assertEquals("AJ", initialsOf("amal jaber"))
        assertEquals("AJ", initialsOf("  Amal  Jaber Khalil "))
        assertEquals("A", initialsOf("Amal"))
        assertEquals("", initialsOf("   "))
        assertEquals("س", initialsOf("سارة"))
    }
}
