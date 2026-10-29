package com.acme.shop.core.ui.media

import kotlin.test.Test
import kotlin.test.assertEquals

class ImageScalingTest {
    @Test
    fun fitKeepsTheAspectRatioAndNeverUpscales() {
        assertEquals(1024 to 768, ImageScaling.fit(4032, 3024))
        assertEquals(768 to 1024, ImageScaling.fit(3024, 4032), "portrait")
        assertEquals(800 to 600, ImageScaling.fit(800, 600), "small photos stay as they are")
        assertEquals(1024 to 1, ImageScaling.fit(10_000, 5), "a side never collapses to 0")
        assertEquals(0 to 0, ImageScaling.fit(0, 0))
    }

    @Test
    fun sampleSizeIsThePowerOfTwoThatStillCoversTheTarget() {
        assertEquals(1, ImageScaling.sampleSize(1024, 768))
        assertEquals(1, ImageScaling.sampleSize(2000, 1500))
        assertEquals(2, ImageScaling.sampleSize(2048, 1536))
        assertEquals(4, ImageScaling.sampleSize(8064, 6048), "48 MP decodes at 2016 px, still above 1024")
        assertEquals(1, ImageScaling.sampleSize(0, 0))
    }
}
