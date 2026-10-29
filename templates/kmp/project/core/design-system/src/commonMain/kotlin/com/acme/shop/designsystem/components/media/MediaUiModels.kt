package com.acme.shop.designsystem.components.media

import androidx.compose.runtime.Immutable

enum class MediaKind { Image, Video }

/** One gallery / service / team media item (item 11, ). Videos carry a poster for the grid tile. */
@Immutable
data class MediaItemUi(
    val id: String,
    val url: String,
    val kind: MediaKind,
    val thumbnailUrl: String? = null,
) {
    val tileUrl: String get() = thumbnailUrl ?: url
}

/** One home banner (item 2); what happens on tap (`actionType`) is decided by the feature. */
@Immutable
data class BannerUi(
    val id: String,
    val imageUrl: String,
)

/** Zoom limits of the media viewer (pinch-to-zoom). */
object MediaViewerDefaults {
    const val MIN_ZOOM = 1f
    const val MAX_ZOOM = 4f
}

/** Keeps the pinch scale inside the allowed range; pure so it is unit-tested. */
fun clampZoom(scale: Float, min: Float = MediaViewerDefaults.MIN_ZOOM, max: Float = MediaViewerDefaults.MAX_ZOOM): Float =
    scale.coerceIn(min, max)

/** Pan is only meaningful while zoomed in; at 1x the pager owns horizontal drags, so the offset resets. */
fun panOffsetFor(scale: Float, current: Float, delta: Float): Float = if (scale > MediaViewerDefaults.MIN_ZOOM) current + delta else 0f

/** The page the auto-swiping banner carousel shows next (wraps around); a single banner never moves. */
fun nextBannerIndex(current: Int, count: Int): Int = if (count <= 1) 0 else (current + 1) % count
