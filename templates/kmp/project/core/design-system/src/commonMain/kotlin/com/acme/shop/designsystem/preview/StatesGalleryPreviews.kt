package com.acme.shop.designsystem.preview

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.acme.shop.designsystem.components.feedback.AppContentState
import com.acme.shop.designsystem.components.feedback.AppStateContent
import com.acme.shop.designsystem.components.shimmer.AppShimmerList
import com.acme.shop.designsystem.components.shimmer.AppShimmerListItem
import com.acme.shop.designsystem.components.shimmer.AppShimmerCard
import com.acme.shop.designsystem.components.shimmer.AppShimmerSection
import com.acme.shop.designsystem.components.text.AppText
import com.acme.shop.designsystem.theme.AppTheme
import com.acme.shop.designsystem.theme.AppWindowSize

/** Every universal state next to its shimmer template (Design Script §1.1), in the same frame set as the component gallery. */
@Composable
private fun StatesGallery() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(AppTheme.colors.background)
            .verticalScroll(rememberScrollState())
            .padding(AppTheme.adaptive.horizontalPadding),
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space16),
    ) {
        AppText(text = "Shimmer: section", style = AppTheme.typography.titleMedium)
        AppShimmerSection()
        AppText(text = "Shimmer: card", style = AppTheme.typography.titleMedium)
        AppShimmerCard()
        AppText(text = "Shimmer: list", style = AppTheme.typography.titleMedium)
        AppShimmerList(itemCount = 2, circularImage = true)
        AppText(text = "Offline", style = AppTheme.typography.titleMedium)
        StatePanel(AppContentState.Offline)
        AppText(text = "Error", style = AppTheme.typography.titleMedium)
        StatePanel(AppContentState.Error("حدث خطأ ما"))
        AppText(text = "Empty", style = AppTheme.typography.titleMedium)
        StatePanel(AppContentState.Empty)
        AppText(text = "Loading more (footer)", style = AppTheme.typography.titleMedium)
        AppShimmerListItem()
    }
}

@Composable
private fun StatePanel(state: AppContentState) {
    AppStateContent(
        state = state,
        onRetry = {},
        modifier = Modifier.fillMaxWidth().height(AppTheme.sizes.dialogMaxWidth),
        loading = { AppShimmerList() },
    ) { }
}

@Composable
private fun StatesPreviewFrame(dark: Boolean, rtl: Boolean, width: Int, height: Int) {
    val direction = if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr
    CompositionLocalProvider(LocalLayoutDirection provides direction) {
        AppTheme(darkTheme = dark, windowSize = AppWindowSize(width.dp, height.dp)) { StatesGallery() }
    }
}

@Preview(widthDp = 390, heightDp = 844)
@Composable
private fun StatesPhonePortraitLightRtlPreview() = StatesPreviewFrame(dark = false, rtl = true, width = 390, height = 844)

@Preview(widthDp = 390, heightDp = 844)
@Composable
private fun StatesPhonePortraitDarkLtrPreview() = StatesPreviewFrame(dark = true, rtl = false, width = 390, height = 844)

@Preview(widthDp = 844, heightDp = 390)
@Composable
private fun StatesPhoneLandscapeLightRtlPreview() = StatesPreviewFrame(dark = false, rtl = true, width = 844, height = 390)

@Preview(widthDp = 1024, heightDp = 768)
@Composable
private fun StatesTabletLandscapeDarkRtlPreview() = StatesPreviewFrame(dark = true, rtl = true, width = 1024, height = 768)
