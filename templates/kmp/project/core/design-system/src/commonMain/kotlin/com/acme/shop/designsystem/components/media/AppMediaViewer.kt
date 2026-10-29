package com.acme.shop.designsystem.components.media

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.acme.shop.designsystem.components.button.AppIconButton
import com.acme.shop.designsystem.components.image.AppImage
import com.acme.shop.designsystem.components.text.AppText
import com.acme.shop.designsystem.icons.AppIcons
import com.acme.shop.designsystem.resources.Res
import com.acme.shop.designsystem.resources.common_close
import com.acme.shop.designsystem.resources.media_position
import com.acme.shop.designsystem.theme.AppTheme
import org.jetbrains.compose.resources.stringResource

/**
 * Full-screen media viewer (): swipe between items, pinch-to-zoom images, play videos with the platform player.
 * Opens on [startIndex]; the close button and the system back gesture call [onClose].
 */
@Composable
fun AppMediaViewer(
    items: List<MediaItemUi>,
    startIndex: Int,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (items.isEmpty()) return
    val pagerState = rememberPagerState(initialPage = startIndex.coerceIn(0, items.lastIndex), pageCount = { items.size })
    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(dismissOnBackPress = true, dismissOnClickOutside = false, usePlatformDefaultWidth = false),
    ) {
        Box(modifier = modifier.fillMaxSize().background(AppTheme.colors.ink)) {
            HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize(), key = { items[it].id }) { page ->
                val item = items[page]
                if (item.kind == MediaKind.Video) {
                    AppVideoPlayer(url = item.url, modifier = Modifier.fillMaxSize())
                } else {
                    ZoomableImage(url = item.url)
                }
            }
            ViewerTopBar(position = pagerState.currentPage + 1, count = items.size, onClose = onClose)
        }
    }
}

@Composable
private fun ViewerTopBar(position: Int, count: Int, onClose: () -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .windowInsetsPadding(WindowInsets.statusBars)
            .padding(AppTheme.spacing.space8),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AppIconButton(AppIcons.Close, stringResource(Res.string.common_close), onClose, tint = AppTheme.colors.onMedia)
        AppText(
            text = stringResource(Res.string.media_position, position, count),
            color = AppTheme.colors.onMedia,
            style = AppTheme.typography.labelLarge,
            modifier = Modifier.padding(start = AppTheme.spacing.space8),
        )
    }
}

/** Pinch-to-zoom image page: scale is clamped, panning only while zoomed so the pager keeps its swipes at 1x. */
@Composable
private fun ZoomableImage(url: String, modifier: Modifier = Modifier) {
    var scale by remember { mutableFloatStateOf(MediaViewerDefaults.MIN_ZOOM) }
    var offsetX by remember { mutableFloatStateOf(0f) }
    var offsetY by remember { mutableFloatStateOf(0f) }
    AppImage(
        url = url,
        contentScale = ContentScale.Fit,
        modifier = modifier
            .fillMaxSize()
            .pointerInput(url) {
                detectTransformGestures { _, pan, zoom, _ ->
                    scale = clampZoom(scale * zoom)
                    offsetX = panOffsetFor(scale, offsetX, pan.x)
                    offsetY = panOffsetFor(scale, offsetY, pan.y)
                }
            }
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
                translationX = offsetX
                translationY = offsetY
            },
    )
}
