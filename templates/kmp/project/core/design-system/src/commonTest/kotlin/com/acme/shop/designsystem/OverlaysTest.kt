package com.acme.shop.designsystem

import com.acme.shop.designsystem.components.badge.StatusTone
import com.acme.shop.designsystem.components.dialog.GlobalDialogKind
import com.acme.shop.designsystem.components.dialog.globalDialogSpec
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class OverlaysTest {

    @Test
    fun sessionExpiredCannotBeDismissedWithoutAcknowledging() {
        val spec = globalDialogSpec(GlobalDialogKind.SessionExpired)
        assertFalse(spec.hasDismissButton)
        assertFalse(spec.dismissOnOutside)
    }

    @Test
    fun destructiveAndWarningKindsUseTheirTones() {
        assertEquals(StatusTone.Danger, globalDialogSpec(GlobalDialogKind.DeleteAccount).tone)
        assertEquals(StatusTone.Warning, globalDialogSpec(GlobalDialogKind.LocationDenied).tone)
        assertEquals(StatusTone.Accent, globalDialogSpec(GlobalDialogKind.AuthRequired).tone)
    }

    @Test
    fun everyOtherKindOffersCancelAndOutsideDismiss() {
        GlobalDialogKind.entries.filter { it != GlobalDialogKind.SessionExpired }.forEach { kind ->
            val spec = globalDialogSpec(kind)
            assertTrue(spec.hasDismissButton, "$kind should offer a dismiss button")
            assertTrue(spec.dismissOnOutside, "$kind should dismiss on outside tap")
        }
    }
}
