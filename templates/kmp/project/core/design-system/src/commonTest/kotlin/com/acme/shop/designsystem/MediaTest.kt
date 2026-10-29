package com.acme.shop.designsystem

import com.acme.shop.designsystem.components.media.MediaItemUi
import com.acme.shop.designsystem.components.media.MediaKind
import com.acme.shop.designsystem.components.media.MediaViewerDefaults
import com.acme.shop.designsystem.components.media.clampZoom
import com.acme.shop.designsystem.components.media.nextBannerIndex
import com.acme.shop.designsystem.components.media.panOffsetFor
import com.acme.shop.designsystem.theme.AppWindowSize
import com.acme.shop.designsystem.theme.adaptiveFor
import androidx.compose.ui.unit.dp
import kotlin.test.Test
import kotlin.test.assertEquals

class MediaTest {

    @Test
    fun zoomStaysBetweenTheLimits() {
        assertEquals(MediaViewerDefaults.MIN_ZOOM, clampZoom(0.2f))
        assertEquals(2.5f, clampZoom(2.5f))
        assertEquals(MediaViewerDefaults.MAX_ZOOM, clampZoom(9f))
    }

    @Test
    fun panOnlyWhileZoomedIn() {
        assertEquals(0f, panOffsetFor(scale = MediaViewerDefaults.MIN_ZOOM, current = 40f, delta = 10f))
        assertEquals(50f, panOffsetFor(scale = 2f, current = 40f, delta = 10f))
    }

    @Test
    fun bannerIndexWrapsAndSingleBannerNeverMoves() {
        assertEquals(1, nextBannerIndex(current = 0, count = 3))
        assertEquals(0, nextBannerIndex(current = 2, count = 3))
        assertEquals(0, nextBannerIndex(current = 0, count = 1))
        assertEquals(0, nextBannerIndex(current = 5, count = 0))
    }

    @Test
    fun videoTilesPreferTheirPoster() {
        assertEquals("poster", MediaItemUi("v", "video.mp4", MediaKind.Video, "poster").tileUrl)
        assertEquals("image.jpg", MediaItemUi("i", "image.jpg", MediaKind.Image).tileUrl)
    }

    @Test
    fun galleryColumnsGrowWithTheWindow() {
        assertEquals(3, adaptiveFor(AppWindowSize(390.dp, 844.dp)).galleryColumns)
        assertEquals(4, adaptiveFor(AppWindowSize(700.dp, 800.dp)).galleryColumns)
        assertEquals(6, adaptiveFor(AppWindowSize(1024.dp, 768.dp)).galleryColumns)
    }
}
