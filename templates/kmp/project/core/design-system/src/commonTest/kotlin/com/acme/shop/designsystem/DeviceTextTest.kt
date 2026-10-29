package com.acme.shop.designsystem

import com.acme.shop.core.ui.external.ExternalApp
import com.acme.shop.core.ui.media.PickResult
import com.acme.shop.core.ui.media.PickedImage
import com.acme.shop.designsystem.components.feedback.externalUnavailableResource
import com.acme.shop.designsystem.components.feedback.pickProblemResource
import com.acme.shop.designsystem.resources.Res
import com.acme.shop.designsystem.resources.photo_camera_unavailable
import com.acme.shop.designsystem.resources.photo_read_failed
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class DeviceTextTest {
    @Test
    fun everyExternalAppHasItsOwnMessage() {
        val resources = ExternalApp.entries.map(::externalUnavailableResource)
        assertEquals(ExternalApp.entries.size, resources.toSet().size)
    }

    @Test
    fun onlyRealPickerProblemsProduceAMessage() {
        assertEquals(Res.string.photo_camera_unavailable, pickProblemResource(PickResult.CameraUnavailable))
        assertEquals(Res.string.photo_read_failed, pickProblemResource(PickResult.Failed))
        assertNull(pickProblemResource(PickResult.Cancelled))
        assertNull(pickProblemResource(PickResult.Picked(PickedImage(ByteArray(1), "image/jpeg"))))
    }
}
