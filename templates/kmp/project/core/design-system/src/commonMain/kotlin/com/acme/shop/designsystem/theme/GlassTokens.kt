package com.acme.shop.designsystem.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Predefined glass appearances, from a light veil to a floating control. */
enum class GlassStyle { Subtle, Regular, Prominent }

/** How strongly one [GlassStyle] fills, shines and floats, relative to the regular content glass. */
@Immutable
data class GlassLevel(val fillScale: Float, val sheenScale: Float, val elevation: Dp)

/**
 * "Liquid Glass" chrome (tab bar, top bar, sheets, dialogs, sticky bars, toasts): backdrop blur + a translucent
 * tint taken from the palette (light: card, dark: background), a white specular rim and a hairline border.
 * [fallbackTintAlpha] is used when there is no blur (no source, Android < 12, previews) so text stays readable.
 */
@Immutable
data class GlassTokens(
    val tint: Color,
    val tintAlpha: Float,
    val fallbackTintAlpha: Float,
    val highlight: Color,
    val highlightTopAlpha: Float,
    val highlightBottomAlpha: Float,
    val border: Color,
    val borderAlpha: Float,
    val borderWidth: Dp = 1.dp,
    val blurRadius: Dp = 24.dp,
    val noiseFactor: Float = 0.04f,
    val shadowElevation: Dp = 16.dp,
    val shadow: Color,
    val shadowAlpha: Float,
    val tabBarShape: Shape = RoundedCornerShape(percent = 50),
    val tabBarInset: Dp = 16.dp,
    val tabBarBottomGap: Dp = 8.dp,
    /** Content glass (cards, buttons, fields, chips): see-through gradient body, top → bottom. */
    val contentTopAlpha: Float,
    val contentBottomAlpha: Float,
    /** Specular sheen over the upper part of every glass shape. */
    val sheenAlpha: Float,
    val sheenFraction: Float = SHEEN_FRACTION,
    /** Refractive edge: bright at the top-start and bottom-end corners, faint along the sides. */
    val rimStrongAlpha: Float,
    val rimWeakAlpha: Float,
    val rimEndAlpha: Float,
    val rimWidth: Dp = 1.2.dp,
    /** Soft violet light behind every screen so the glass has something to show through. */
    val ambientStart: Color,
    val ambientEnd: Color,
    val ambientAlpha: Float,
    /** Liquid press: the shape shrinks and springs back (no ripple, as on iOS). */
    val pressScale: Float = PRESS_SCALE,
    val subtle: GlassLevel = GlassLevel(SUBTLE_FILL, SUBTLE_SHEEN, 2.dp),
    val regular: GlassLevel = GlassLevel(1f, 1f, 6.dp),
    val prominent: GlassLevel = GlassLevel(PROMINENT_FILL, PROMINENT_SHEEN, 14.dp),
) {
    /** The level of [style]. */
    fun level(style: GlassStyle): GlassLevel = when (style) {
        GlassStyle.Subtle -> subtle
        GlassStyle.Regular -> regular
        GlassStyle.Prominent -> prominent
    }

    /** Top and bottom colours of the translucent body of [style] (alpha capped at 1). */
    fun fillTop(style: GlassStyle): Color = contentTop.copy(alpha = (contentTopAlpha * level(style).fillScale).coerceAtMost(1f))
    fun fillBottom(style: GlassStyle): Color =
        contentBottom.copy(alpha = (contentBottomAlpha * level(style).fillScale).coerceAtMost(1f))

    /** Sheen alpha of [style]. */
    fun sheen(style: GlassStyle): Float = (sheenAlpha * level(style).sheenScale).coerceAtMost(1f)

    /** Body of content glass: light glass in light mode, a white frost in dark mode. */
    val contentTop: Color get() = contentBase.copy(alpha = contentTopAlpha)
    val contentBottom: Color get() = contentBase.copy(alpha = contentBottomAlpha)
    private val contentBase: Color get() = if (tint.luminanceIsDark()) highlight else tint

    /** Tint colour drawn over the blurred backdrop. */
    val tintColor: Color get() = tint.copy(alpha = tintAlpha)

    /** Tint colour when blur is unavailable: more opaque, so the chrome never becomes see-through. */
    val fallbackColor: Color get() = tint.copy(alpha = fallbackTintAlpha)
}

private const val SUBTLE_FILL = 0.55f
private const val SUBTLE_SHEEN = 0.6f
private const val PROMINENT_FILL = 1.2f
private const val PROMINENT_SHEEN = 1.3f
private const val SHEEN_FRACTION = 0.55f
private const val PRESS_SCALE = 0.95f
private const val LIGHT_CONTENT_TOP = 0.62f
private const val LIGHT_CONTENT_BOTTOM = 0.34f
private const val DARK_CONTENT_TOP = 0.18f
private const val DARK_CONTENT_BOTTOM = 0.06f
private const val LIGHT_SHEEN = 0.55f
private const val DARK_SHEEN = 0.10f
private const val LIGHT_RIM_STRONG = 1f
private const val DARK_RIM_STRONG = 0.45f
private const val LIGHT_RIM_WEAK = 0.25f
private const val DARK_RIM_WEAK = 0.06f
private const val LIGHT_RIM_END = 0.7f
private const val DARK_RIM_END = 0.22f
private const val LIGHT_AMBIENT = 0.26f
private const val DARK_AMBIENT = 0.30f
private const val LIGHT_TINT_ALPHA = 0.62f
private const val DARK_TINT_ALPHA = 0.55f
private const val LIGHT_FALLBACK_ALPHA = 0.94f
private const val DARK_FALLBACK_ALPHA = 0.92f
private const val LIGHT_HIGHLIGHT_TOP = 0.85f
private const val DARK_HIGHLIGHT_TOP = 0.22f
private const val LIGHT_HIGHLIGHT_BOTTOM = 0.15f
private const val DARK_HIGHLIGHT_BOTTOM = 0.04f
private const val LIGHT_BORDER_ALPHA = 0.22f
private const val DARK_BORDER_ALPHA = 1f
private const val LIGHT_SHADOW_ALPHA = 0.16f
private const val DARK_SHADOW_ALPHA = 0.4f

/** Glass values derived from the active palette, so the glass always matches the violet theme. */
fun glassTokensFor(colors: AppColors): GlassTokens = if (colors.isDark) {
    GlassTokens(
        tint = colors.background,
        tintAlpha = DARK_TINT_ALPHA,
        fallbackTintAlpha = DARK_FALLBACK_ALPHA,
        highlight = colors.onGradient,
        highlightTopAlpha = DARK_HIGHLIGHT_TOP,
        highlightBottomAlpha = DARK_HIGHLIGHT_BOTTOM,
        border = colors.line,
        borderAlpha = DARK_BORDER_ALPHA,
        shadow = colors.shadow,
        shadowAlpha = DARK_SHADOW_ALPHA,
        contentTopAlpha = DARK_CONTENT_TOP,
        contentBottomAlpha = DARK_CONTENT_BOTTOM,
        sheenAlpha = DARK_SHEEN,
        rimStrongAlpha = DARK_RIM_STRONG,
        rimWeakAlpha = DARK_RIM_WEAK,
        rimEndAlpha = DARK_RIM_END,
        ambientStart = colors.gradientStart,
        ambientEnd = colors.gradientEnd,
        ambientAlpha = DARK_AMBIENT,
    )
} else {
    GlassTokens(
        tint = colors.card,
        tintAlpha = LIGHT_TINT_ALPHA,
        fallbackTintAlpha = LIGHT_FALLBACK_ALPHA,
        highlight = colors.onGradient,
        highlightTopAlpha = LIGHT_HIGHLIGHT_TOP,
        highlightBottomAlpha = LIGHT_HIGHLIGHT_BOTTOM,
        border = colors.gradientStart,
        borderAlpha = LIGHT_BORDER_ALPHA,
        shadow = colors.gradientStart,
        shadowAlpha = LIGHT_SHADOW_ALPHA,
        contentTopAlpha = LIGHT_CONTENT_TOP,
        contentBottomAlpha = LIGHT_CONTENT_BOTTOM,
        sheenAlpha = LIGHT_SHEEN,
        rimStrongAlpha = LIGHT_RIM_STRONG,
        rimWeakAlpha = LIGHT_RIM_WEAK,
        rimEndAlpha = LIGHT_RIM_END,
        ambientStart = colors.gradientStart,
        ambientEnd = colors.gradientEnd,
        ambientAlpha = LIGHT_AMBIENT,
    )
}

val DefaultGlass = glassTokensFor(LightColors)

private const val DARK_LUMINANCE = 0.5f

private fun Color.luminanceIsDark(): Boolean = (red + green + blue) / 3f < DARK_LUMINANCE
