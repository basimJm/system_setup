package com.acme.shop.designsystem.preview

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.acme.shop.designsystem.components.image.AppImageFallback
import com.acme.shop.designsystem.components.media.AppBannerCarousel
import com.acme.shop.designsystem.components.media.AppGalleryGrid
import com.acme.shop.designsystem.components.media.BannerUi
import com.acme.shop.designsystem.components.media.MediaItemUi
import com.acme.shop.designsystem.components.media.MediaKind
import com.acme.shop.designsystem.components.text.AppText
import com.acme.shop.designsystem.theme.AppTheme
import com.acme.shop.designsystem.theme.AppWindowSize

private const val GALLERY_ITEMS = 9
private const val VIDEO_EVERY = 4

/** Previews run without a network, so image slots show the loading / fallback looks; layout is what is checked here. */
@Composable
private fun MediaGallery() {
    val banners = listOf(BannerUi("b1", ""), BannerUi("b2", ""), BannerUi("b3", ""))
    val items = List(GALLERY_ITEMS) { index ->
        MediaItemUi("m$index", "", if (index % VIDEO_EVERY == 0) MediaKind.Video else MediaKind.Image)
    }
    Column(
        modifier = Modifier.fillMaxWidth().background(AppTheme.colors.background).padding(AppTheme.adaptive.horizontalPadding),
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space16),
    ) {
        AppText(text = "Banner carousel", style = AppTheme.typography.titleMedium)
        AppBannerCarousel(banners = banners, onClick = {})
        AppText(text = "Image fallback", style = AppTheme.typography.titleMedium)
        AppImageFallback(Modifier.fillMaxWidth().height(AppTheme.sizes.cardImageHeight))
        AppText(text = "Gallery grid", style = AppTheme.typography.titleMedium)
        AppGalleryGrid(items = items, onOpen = {}, modifier = Modifier.height(AppTheme.sizes.dialogMaxWidth))
    }
}

@Composable
private fun MediaPreviewFrame(dark: Boolean, rtl: Boolean, width: Int, height: Int) {
    val direction = if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr
    CompositionLocalProvider(LocalLayoutDirection provides direction) {
        AppTheme(darkTheme = dark, windowSize = AppWindowSize(width.dp, height.dp)) { MediaGallery() }
    }
}

@Preview(widthDp = 390, heightDp = 844)
@Composable
private fun MediaPhonePortraitLightRtlPreview() = MediaPreviewFrame(dark = false, rtl = true, width = 390, height = 844)

@Preview(widthDp = 390, heightDp = 844)
@Composable
private fun MediaPhonePortraitDarkLtrPreview() = MediaPreviewFrame(dark = true, rtl = false, width = 390, height = 844)

@Preview(widthDp = 844, heightDp = 390)
@Composable
private fun MediaPhoneLandscapeLightRtlPreview() = MediaPreviewFrame(dark = false, rtl = true, width = 844, height = 390)

@Preview(widthDp = 1024, heightDp = 768)
@Composable
private fun MediaTabletLandscapeDarkRtlPreview() = MediaPreviewFrame(dark = true, rtl = true, width = 1024, height = 768)
