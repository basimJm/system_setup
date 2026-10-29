package com.acme.shop.designsystem

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.unit.dp
import com.acme.shop.designsystem.components.glass.GlassMode
import com.acme.shop.designsystem.components.glass.glassModeOf
import com.acme.shop.designsystem.theme.DarkColors
import com.acme.shop.designsystem.theme.DefaultGlass
import com.acme.shop.designsystem.theme.GlassStyle
import com.acme.shop.designsystem.theme.GlassTokens
import com.acme.shop.designsystem.theme.LightColors
import com.acme.shop.designsystem.theme.glassTokensFor
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class GlassTokensTest {
    private val light = glassTokensFor(LightColors)
    private val dark = glassTokensFor(DarkColors)

    @Test
    fun tintComesFromThePalette() {
        assertEquals(LightColors.card, light.tint)
        assertEquals(DarkColors.background, dark.tint)
        assertEquals(LightColors.gradientStart, light.border, "light glass edge is a soft violet")
        assertEquals(DarkColors.line, dark.border)
        assertEquals(LightColors.gradientStart, light.shadow, "light glass casts a violet glow")
        assertEquals(DarkColors.shadow, dark.shadow)
        assertEquals(light, DefaultGlass)
    }

    @Test
    fun tintColoursCarryTheirAlpha() {
        listOf(light, dark).forEach { t ->
            assertEquals(t.tintAlpha, t.tintColor.alpha, ALPHA_TOLERANCE)
            assertEquals(t.fallbackTintAlpha, t.fallbackColor.alpha, ALPHA_TOLERANCE)
        }
    }

    @Test
    fun alphasAreInRangeAndFallbackIsMoreOpaque() {
        listOf(light, dark).forEach { t -> alphas(t).forEach { assertTrue(it in 0f..1f, "alpha $it out of range") } }
        listOf(light, dark).forEach { t ->
            assertTrue(t.fallbackTintAlpha > t.tintAlpha, "fallback must hide the content more than the blurred tint")
            assertTrue(t.highlightTopAlpha > t.highlightBottomAlpha, "specular rim fades top to bottom")
        }
    }

    @Test
    fun sizesArePositive() {
        listOf(light, dark).forEach { t ->
            assertTrue(t.blurRadius > 0.dp)
            assertTrue(t.borderWidth > 0.dp)
            assertTrue(t.shadowElevation > 0.dp)
            assertTrue(t.tabBarInset > 0.dp)
        }
    }

    @Test
    fun blurOnlyWithSourceSupportAndOutsidePreviews() {
        assertEquals(GlassMode.Blur, glassModeOf(hasSource = true, blurSupported = true, inPreview = false))
        assertEquals(GlassMode.TintOnly, glassModeOf(hasSource = false, blurSupported = true, inPreview = false))
        assertEquals(GlassMode.TintOnly, glassModeOf(hasSource = true, blurSupported = false, inPreview = false))
        assertEquals(GlassMode.TintOnly, glassModeOf(hasSource = true, blurSupported = true, inPreview = true))
    }

    private fun alphas(t: GlassTokens) = listOf(
        t.tintAlpha, t.fallbackTintAlpha, t.highlightTopAlpha, t.highlightBottomAlpha, t.borderAlpha, t.shadowAlpha, t.noiseFactor,
    )

    @Test
    fun contentGlassIsSeeThroughAndLighterAtTheTop() {
        listOf(light, dark).forEach { t ->
            assertTrue(t.contentTop.alpha > t.contentBottom.alpha)
            assertTrue(t.contentTop.alpha < 1f, "content glass must let the backdrop show")
        }
        assertEquals(LightColors.card.red, light.contentTop.red, ALPHA_TOLERANCE)
        assertEquals(DarkColors.onGradient.red, dark.contentTop.red, ALPHA_TOLERANCE)
    }

    @Test
    fun rimCatchesLightAtTheCornersAndPressShrinks() {
        listOf(light, dark).forEach { t ->
            assertTrue(t.rimStrongAlpha > t.rimEndAlpha && t.rimEndAlpha > t.rimWeakAlpha)
            assertTrue(t.pressScale in 0.9f..<1f)
            assertTrue(t.sheenFraction in 0f..1f)
        }
        assertEquals(LightColors.gradientStart, light.ambientStart)
        assertEquals(DarkColors.gradientEnd, dark.ambientEnd)
        assertTrue(dark.ambientAlpha > light.ambientAlpha)
    }

    @Test
    fun contentModeIsItsOwnMaterial() {
        assertTrue(GlassMode.entries.contains(GlassMode.Content))
    }

    @Test
    fun stylesGrowFromSubtleToProminent() {
        listOf(light, dark).forEach { t ->
            val (subtle, regular, prominent) = GlassStyle.entries.map { t.fillTop(it).alpha }
            assertTrue(subtle < regular && regular < prominent)
            assertTrue(t.sheen(GlassStyle.Subtle) < t.sheen(GlassStyle.Prominent))
            assertTrue(t.level(GlassStyle.Prominent).elevation > t.level(GlassStyle.Regular).elevation)
            GlassStyle.entries.forEach { style ->
                assertTrue(t.fillTop(style).alpha <= 1f && t.fillBottom(style).alpha <= 1f && t.sheen(style) <= 1f)
                assertTrue(t.fillTop(style).alpha >= t.fillBottom(style).alpha)
            }
        }
    }

    @Test
    fun textOnEveryStyleKeepsAaContrastOverTheScreenBackground() {
        listOf(LightColors to light, DarkColors to dark).forEach { (colors, t) ->
            GlassStyle.entries.forEach { style ->
                listOf(t.fillTop(style), t.fillBottom(style)).forEach { fill ->
                    val surface = fill.compositeOver(colors.background)
                    assertTrue(contrast(colors.ink, surface) >= AA_TEXT, "$style ${colors.isDark}")
                }
            }
        }
    }

    @Test
    fun blurOnlyWithABackdropThatCanBlur() {
        assertEquals(GlassMode.Blur, glassModeOf(hasSource = true, blurSupported = true, inPreview = false))
        assertEquals(GlassMode.TintOnly, glassModeOf(hasSource = false, blurSupported = true, inPreview = false))
        assertEquals(GlassMode.TintOnly, glassModeOf(hasSource = true, blurSupported = false, inPreview = false))
        assertEquals(GlassMode.TintOnly, glassModeOf(hasSource = true, blurSupported = true, inPreview = true))
    }

    private fun contrast(a: Color, b: Color): Float {
        val (hi, lo) = listOf(a.luminance(), b.luminance()).sortedDescending()
        return (hi + LUMINANCE_OFFSET) / (lo + LUMINANCE_OFFSET)
    }

    private companion object {
        const val AA_TEXT = 4.5f
        const val LUMINANCE_OFFSET = 0.05f
        const val ALPHA_TOLERANCE = 0.01f
    }
}
