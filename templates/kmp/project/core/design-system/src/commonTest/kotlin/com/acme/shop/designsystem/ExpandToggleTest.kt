package com.acme.shop.designsystem

import com.acme.shop.designsystem.components.text.expandToggleVisible
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** and showed "more" under one-line texts; the toggle follows real overflow only. */
class ExpandToggleTest {

    @Test
    fun shortTextHasNoToggle() {
        assertFalse(expandToggleVisible(overflows = false, expanded = false))
    }

    @Test
    fun overflowingTextOffersMore() {
        assertTrue(expandToggleVisible(overflows = true, expanded = false))
    }

    @Test
    fun expandedTextOffersLess() {
        assertTrue(expandToggleVisible(overflows = false, expanded = true))
    }
}
