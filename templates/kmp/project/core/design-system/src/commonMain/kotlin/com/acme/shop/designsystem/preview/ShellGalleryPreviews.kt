package com.acme.shop.designsystem.preview

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.acme.shop.designsystem.components.feedback.AppEmptyState
import com.acme.shop.designsystem.components.layout.AppScreen
import com.acme.shop.designsystem.components.navigation.AppNavItem
import com.acme.shop.designsystem.components.navigation.AppNavScaffold
import com.acme.shop.designsystem.icons.AppIcons
import com.acme.shop.designsystem.theme.AppTheme
import com.acme.shop.designsystem.theme.AppWindowSize

private const val LARGE_FONT_SCALE = 2f
private const val ACTIVITY_BADGE = 3

private val Tabs = listOf(
    AppNavItem("home", "الرئيسية", AppIcons.Home),
    AppNavItem("saved", "المحفوظات", AppIcons.Favorite),
    AppNavItem("activity", "النشاط", AppIcons.Calendar, badgeCount = ACTIVITY_BADGE),
    AppNavItem("profile", "الملف الشخصي", AppIcons.Profile),
)

/** The app shell: four tabs as a bottom bar on phones in portrait and a rail everywhere else. */
@Composable
private fun ShellGallery() {
    AppNavScaffold(items = Tabs, selectedId = Tabs.first().id, onSelect = {}) {
        AppScreen {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { AppEmptyState(title = "الرئيسية") }
        }
    }
}

@Composable
private fun ShellPreviewFrame(dark: Boolean, rtl: Boolean, width: Int, height: Int, fontScale: Float = 1f) {
    val direction = if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr
    val density = Density(LocalDensity.current.density, fontScale)
    CompositionLocalProvider(LocalLayoutDirection provides direction, LocalDensity provides density) {
        AppTheme(darkTheme = dark, windowSize = AppWindowSize(width.dp, height.dp)) { ShellGallery() }
    }
}

@Preview(widthDp = 390, heightDp = 844)
@Composable
private fun ShellPhonePortraitLightRtlPreview() = ShellPreviewFrame(dark = false, rtl = true, width = 390, height = 844)

@Preview(widthDp = 390, heightDp = 844)
@Composable
private fun ShellPhonePortraitDarkLtrPreview() = ShellPreviewFrame(dark = true, rtl = false, width = 390, height = 844)

@Preview(widthDp = 390, heightDp = 844, fontScale = LARGE_FONT_SCALE)
@Composable
private fun ShellPhonePortraitLargeFontRtlPreview() =
    ShellPreviewFrame(dark = false, rtl = true, width = 390, height = 844, fontScale = LARGE_FONT_SCALE)

@Preview(widthDp = 844, heightDp = 390)
@Composable
private fun ShellPhoneLandscapeLightRtlPreview() = ShellPreviewFrame(dark = false, rtl = true, width = 844, height = 390)

@Preview(widthDp = 1024, heightDp = 768)
@Composable
private fun ShellTabletLandscapeDarkRtlPreview() = ShellPreviewFrame(dark = true, rtl = true, width = 1024, height = 768)
