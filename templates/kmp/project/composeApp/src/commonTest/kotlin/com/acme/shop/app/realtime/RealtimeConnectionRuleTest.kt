package com.acme.shop.app.realtime

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class RealtimeConnectionRuleTest {

    @Test
    fun onlyAResumedSignedInAppHoldsTheSocket() {
        assertTrue(shouldHoldRealtimeConnection(isResumed = true, isSignedIn = true))
        assertFalse(shouldHoldRealtimeConnection(isResumed = false, isSignedIn = true))
        assertFalse(shouldHoldRealtimeConnection(isResumed = true, isSignedIn = false))
    }
}
