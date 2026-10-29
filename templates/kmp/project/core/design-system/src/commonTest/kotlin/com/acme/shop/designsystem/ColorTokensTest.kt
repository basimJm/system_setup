package com.acme.shop.designsystem

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.luminance
import com.acme.shop.designsystem.components.badge.StatusTone
import com.acme.shop.designsystem.components.badge.statusColors
import com.acme.shop.designsystem.theme.AppColors
import com.acme.shop.designsystem.theme.DarkColors
import com.acme.shop.designsystem.theme.LightColors
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class ColorTokensTest {
    private fun contrast(a: Color, b: Color): Float {
        val first = a.luminance()
        val second = b.luminance()
        return (maxOf(first, second) + LUMINANCE_OFFSET) / (minOf(first, second) + LUMINANCE_OFFSET)
    }

    private fun assertReadable(palette: AppColors, minimum: Float) {
        assertTrue(contrast(palette.ink, palette.background) >= minimum)
        assertTrue(contrast(palette.muted, palette.background) >= minimum)
        assertTrue(contrast(palette.accent, palette.background) >= minimum)
        assertTrue(contrast(palette.onGradient, palette.gradientStart) >= minimum)
        assertTrue(contrast(palette.onAccent, palette.accent) >= minimum)
    }

    @Test
    fun bothThemesMeetBodyTextContrast() {
        assertReadable(LightColors, BODY_CONTRAST)
        assertReadable(DarkColors, BODY_CONTRAST)
    }

    @Test
    fun statusTextIsReadableOnItsTintedContainer() {
        listOf(LightColors, DarkColors).forEach { palette ->
            StatusTone.entries.forEach { tone ->
                val (content, container) = statusColors(tone, palette)
                val opaque = container.compositeOver(palette.card)
                assertTrue(contrast(content, opaque) >= BODY_CONTRAST, "$tone in dark=${palette.isDark}")
            }
        }
    }

    @Test
    fun everyToneHasDistinctColors() {
        val contents = StatusTone.entries.map { statusColors(it, LightColors).first }
        assertEquals(contents.size, contents.toSet().size)
    }

    @Test
    fun themesDifferWhereTheDesignDiffers() {
        assertNotEquals(LightColors.background, DarkColors.background)
        assertNotEquals(LightColors.accent, DarkColors.accent)
        assertEquals(LightColors.gradientStart, DarkColors.gradientStart)
        assertEquals(LightColors.gradientEnd, DarkColors.gradientEnd)
    }

    private companion object {
        const val BODY_CONTRAST = 4.5f
        const val LUMINANCE_OFFSET = 0.05f
    }
}
