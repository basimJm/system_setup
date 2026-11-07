package com.acme.shop.designsystem.preview

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.acme.shop.designsystem.components.button.AppPrimaryButton
import com.acme.shop.designsystem.components.chip.ActiveFilterChip
import com.acme.shop.designsystem.components.chip.AppFilterChipRow
import com.acme.shop.designsystem.components.dialog.AppSheetHeader
import com.acme.shop.designsystem.components.layout.AppStickyActionBar
import com.acme.shop.designsystem.components.stepper.AppStepIndicator
import com.acme.shop.designsystem.components.text.AppText
import com.acme.shop.designsystem.theme.AppTheme
import com.acme.shop.designsystem.theme.AppWindowSize

private const val FLOW_STEPS = 6
private const val CURRENT_STEP = 3

private val ActiveFilters = listOf(
    ActiveFilterChip("category:1", "الفئة الأولى"),
    ActiveFilterChip("category:2", "الفئة الثانية"),
    ActiveFilterChip("price", "20 – 80 XXX"),
    ActiveFilterChip("general:nearest", "الأقرب"),
    ActiveFilterChip("rating:4", "4 نجوم فأكثر"),
)

/** The in-screen overlay parts (sheet header, active filter chips, step indicator, sticky bar); dialogs are windows. */
@Composable
private fun OverlaysGallery() {
    Column(
        modifier = Modifier.fillMaxWidth().background(AppTheme.colors.background),
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space16),
    ) {
        AppSheetHeader(title = "الفلتر", onClose = {}, action = { AppText(text = "إعادة", color = AppTheme.colors.accent) })
        Column(
            modifier = Modifier.padding(horizontal = AppTheme.adaptive.horizontalPadding),
            verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space16),
        ) {
            AppFilterChipRow(chips = ActiveFilters, onRemove = {})
            AppStepIndicator(currentStep = CURRENT_STEP, stepCount = FLOW_STEPS)
        }
        AppStickyActionBar { AppPrimaryButton(text = "احجز الآن", onClick = {}, modifier = Modifier.fillMaxWidth()) }
    }
}

@Composable
private fun OverlaysPreviewFrame(dark: Boolean, rtl: Boolean, width: Int, height: Int) {
    val direction = if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr
    CompositionLocalProvider(LocalLayoutDirection provides direction) {
        AppTheme(darkTheme = dark, windowSize = AppWindowSize(width.dp, height.dp)) { OverlaysGallery() }
    }
}

@Preview(widthDp = 390, heightDp = 844)
@Composable
private fun OverlaysPhonePortraitLightRtlPreview() = OverlaysPreviewFrame(dark = false, rtl = true, width = 390, height = 844)

@Preview(widthDp = 390, heightDp = 844)
@Composable
private fun OverlaysPhonePortraitDarkLtrPreview() = OverlaysPreviewFrame(dark = true, rtl = false, width = 390, height = 844)

@Preview(widthDp = 844, heightDp = 390)
@Composable
private fun OverlaysPhoneLandscapeLightRtlPreview() = OverlaysPreviewFrame(dark = false, rtl = true, width = 844, height = 390)

@Preview(widthDp = 1024, heightDp = 768)
@Composable
private fun OverlaysTabletLandscapeDarkRtlPreview() = OverlaysPreviewFrame(dark = true, rtl = true, width = 1024, height = 768)
