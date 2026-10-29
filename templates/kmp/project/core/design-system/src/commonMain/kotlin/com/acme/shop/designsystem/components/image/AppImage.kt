package com.acme.shop.designsystem.components.image

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import coil3.compose.AsyncImage
import coil3.compose.AsyncImagePainter
import com.acme.shop.designsystem.components.shimmer.AppShimmerBox
import com.acme.shop.designsystem.icons.AppIcons
import com.acme.shop.designsystem.theme.AppTheme

/**
 * Every remote image goes through here: the shared Coil loader (memory + disk cache),
 * a shimmer while loading and a muted fallback when the URL fails, so no screen shows a blank hole.
 */
@Composable
fun AppImage(
    modifier: Modifier = Modifier,
    url: String,
    contentDescription: String? = null,
    contentScale: ContentScale = ContentScale.Crop,
) {
    val imageLoader = LocalImageLoader.current
    // AsyncImage + plain overlays instead of SubcomposeAsyncImage. Subcomposition per image was the main
    // cost of scrolling items/service lists (skill: avoid SubcomposeLayout in lazy items); the look is unchanged.
    var overlay by remember(url) { mutableStateOf(ImageOverlay.Loading) }
    Box(modifier = modifier) {
        AsyncImage(
            model = url,
            contentDescription = contentDescription,
            imageLoader = imageLoader,
            modifier = Modifier.fillMaxSize(),
            contentScale = contentScale,
            onState = { overlay = imageOverlayOf(it) },
        )
        when (overlay) {
            ImageOverlay.Loading -> AppShimmerBox(Modifier.fillMaxSize())
            ImageOverlay.Fallback -> AppImageFallback()
            ImageOverlay.None -> Unit
        }
    }
}

/** What is drawn over the image: a shimmer while loading, the fallback on error, nothing once it shows. */
internal enum class ImageOverlay { None, Loading, Fallback }

internal fun imageOverlayOf(state: AsyncImagePainter.State): ImageOverlay = when (state) {
    is AsyncImagePainter.State.Success -> ImageOverlay.None
    is AsyncImagePainter.State.Error -> ImageOverlay.Fallback
    is AsyncImagePainter.State.Loading, AsyncImagePainter.State.Empty -> ImageOverlay.Loading
}

/** Muted placeholder used when an image is missing or failed; also the look of tiles without a URL. */
@Composable
fun AppImageFallback(modifier: Modifier = Modifier) {
    Box(modifier = modifier.fillMaxSize().background(AppTheme.colors.soft), contentAlignment = Alignment.Center) {
        Icon(
            imageVector = AppIcons.Image,
            contentDescription = null,
            tint = AppTheme.colors.faint,
            modifier = Modifier.size(AppTheme.sizes.iconLarge),
        )
    }
}
