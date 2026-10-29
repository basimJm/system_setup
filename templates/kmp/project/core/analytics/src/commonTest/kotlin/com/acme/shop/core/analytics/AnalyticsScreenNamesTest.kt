package com.acme.shop.core.analytics

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class AnalyticsScreenNamesTest {

    @Test
    fun typedRoutesBecomeSnakeCaseScreenNames() {
        val typed = "com.acme.shop.core.navigation.route.Screen.ItemDetails/{itemId}"
        assertEquals("item_details", AnalyticsScreenNames.fromRoute(typed))
        assertEquals("home", AnalyticsScreenNames.fromRoute("com.acme.shop.core.navigation.route.Graph.Home"))
        assertEquals("sample_details", AnalyticsScreenNames.fromRoute("route.Screen\$SampleDetails?itemId={itemId}"))
        assertEquals("otp", AnalyticsScreenNames.fromRoute("OTP"))
        assertEquals("order_step_otp", AnalyticsScreenNames.fromRoute("OrderStepOTP"))
    }

    @Test
    fun emptyRoutesHaveNoName() {
        assertNull(AnalyticsScreenNames.fromRoute(null))
        assertNull(AnalyticsScreenNames.fromRoute(""))
        assertNull(AnalyticsScreenNames.fromRoute("/{id}"))
    }
}
