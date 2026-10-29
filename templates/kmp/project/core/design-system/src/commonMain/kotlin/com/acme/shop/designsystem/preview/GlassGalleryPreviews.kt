package com.acme.shop.designsystem.preview

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.acme.shop.designsystem.components.glass.AppGlassSurface
import com.acme.shop.designsystem.components.text.AppText
import com.acme.shop.designsystem.icons.AppIcons
import com.acme.shop.designsystem.theme.AppTheme
import com.acme.shop.designsystem.theme.AppWindowSize
import com.acme.shop.designsystem.theme.GlassStyle

private const val PHONE_WIDTH = 390
private const val PHONE_HEIGHT = 844
private const val LONG_TEXT = "صالون الأستاذ للحلاقة الرجالية — قص شعر، تهذيب لحية، حلاقة بالموس ومنشفة ساخنة، " +
    "وخدمات العناية بالبشرة. مفتوح يوميًا من التاسعة صباحًا حتى العاشرة مساءً."

/** Every [GlassStyle] over the plain, brand-gradient and hero backgrounds, with long text, nesting and a narrow slot. */
@Composable
private fun GlassGallery() {
    val colors = AppTheme.colors
    val spacing = AppTheme.spacing
    val backgrounds = listOf(
        Brush.verticalGradient(listOf(colors.background, colors.background)),
        Brush.linearGradient(listOf(colors.gradientStart, colors.gradientEnd)),
        Brush.linearGradient(listOf(colors.heroStart, colors.heroMiddle, colors.heroEnd)),
    )
    Column(verticalArrangement = Arrangement.spacedBy(spacing.space8)) {
        backgrounds.forEach { backdrop ->
            Column(
                modifier = Modifier.fillMaxWidth().background(backdrop).padding(spacing.space16),
                verticalArrangement = Arrangement.spacedBy(spacing.space12),
            ) {
                GlassStyle.entries.forEach { style ->
                    AppGlassSurface(modifier = Modifier.fillMaxWidth(), style = style, contentPadding = PaddingValues(spacing.space16)) {
                        AppText(text = style.name, style = AppTheme.typography.titleMedium)
                    }
                }
                AppGlassSurface(contentPadding = PaddingValues(spacing.space16)) {
                    Column(verticalArrangement = Arrangement.spacedBy(spacing.space8)) {
                        AppText(text = LONG_TEXT)
                        AppGlassSurface(style = GlassStyle.Subtle, contentPadding = PaddingValues(spacing.space8)) {
                            AppText(text = "متداخل", style = AppTheme.typography.labelMedium)
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(spacing.space12)) {
                    AppGlassSurface(
                        shape = AppTheme.shapes.circle,
                        style = GlassStyle.Prominent,
                        contentPadding = PaddingValues(spacing.space12),
                    ) {
                        Icon(AppIcons.Calendar, contentDescription = null, tint = colors.ink)
                    }
                    AppGlassSurface(
                        modifier = Modifier.widthIn(max = AppTheme.sizes.touchTarget * 2),
                        contentPadding = PaddingValues(spacing.space8),
                    ) {
                        AppText(text = LONG_TEXT, maxLines = 2)
                    }
                }
            }
        }
    }
}

@Composable
private fun GlassPreviewFrame(dark: Boolean, rtl: Boolean, width: Int = PHONE_WIDTH, height: Int = PHONE_HEIGHT) {
    val direction = if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr
    CompositionLocalProvider(LocalLayoutDirection provides direction) {
        AppTheme(darkTheme = dark, windowSize = AppWindowSize(width.dp, height.dp)) { GlassGallery() }
    }
}

@Preview(widthDp = 390, heightDp = 1400)
@Composable
private fun GlassLightRtlPreview() = GlassPreviewFrame(dark = false, rtl = true)

@Preview(widthDp = 390, heightDp = 1400)
@Composable
private fun GlassDarkLtrPreview() = GlassPreviewFrame(dark = true, rtl = false)

@Preview(widthDp = 390, heightDp = 1800, fontScale = 2f)
@Composable
private fun GlassFontScaleLightRtlPreview() = GlassPreviewFrame(dark = false, rtl = true)
