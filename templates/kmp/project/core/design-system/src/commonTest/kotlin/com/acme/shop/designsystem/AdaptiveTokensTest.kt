package com.acme.shop.designsystem

import androidx.compose.ui.unit.dp
import com.acme.shop.designsystem.theme.AppOrientation
import com.acme.shop.designsystem.theme.AppWindowSize
import com.acme.shop.designsystem.theme.HeightClass
import com.acme.shop.designsystem.theme.NavigationStyle
import com.acme.shop.designsystem.theme.WidthClass
import com.acme.shop.designsystem.theme.adaptiveFor
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AdaptiveTokensTest {
    private fun size(width: Int, height: Int) = AppWindowSize(width.dp, height.dp)

    @Test
    fun phonePortraitUsesBottomBarAndOneColumn() {
        val window = size(390, 844)
        val adaptive = adaptiveFor(window)
        assertEquals(WidthClass.Compact, window.widthClass)
        assertEquals(AppOrientation.Portrait, window.orientation)
        assertEquals(NavigationStyle.BottomBar, adaptive.navigation)
        assertEquals(1, adaptive.gridColumns)
        assertFalse(adaptive.twoPane)
    }

    @Test
    fun phoneLandscapeUsesRailAndMoreColumns() {
        val window = size(844, 390)
        val adaptive = adaptiveFor(window)
        assertTrue(window.isLandscape)
        assertEquals(HeightClass.Compact, window.heightClass)
        assertEquals(WidthClass.Expanded, window.widthClass)
        assertEquals(NavigationStyle.Rail, adaptive.navigation)
        assertEquals(3, adaptive.gridColumns)
    }

    @Test
    fun tabletPortraitIsMediumWithTwoColumns() {
        val adaptive = adaptiveFor(size(800, 1280))
        assertEquals(WidthClass.Medium, adaptive.window.widthClass)
        assertEquals(HeightClass.Expanded, adaptive.window.heightClass)
        assertEquals(2, adaptive.gridColumns)
        assertEquals(NavigationStyle.Rail, adaptive.navigation)
    }

    @Test
    fun widthBreakpointsAreInclusiveOnTheUpperClass() {
        assertEquals(WidthClass.Compact, size(599, 800).widthClass)
        assertEquals(WidthClass.Medium, size(600, 800).widthClass)
        assertEquals(WidthClass.Medium, size(839, 800).widthClass)
        assertEquals(WidthClass.Expanded, size(840, 800).widthClass)
    }

    @Test
    fun squareWindowCountsAsPortrait() {
        assertEquals(AppOrientation.Portrait, size(700, 700).orientation)
    }

    @Test
    fun contentWidthAndMarginsGrowWithTheWindow() {
        val compact = adaptiveFor(size(360, 640))
        val medium = adaptiveFor(size(700, 900))
        val expanded = adaptiveFor(size(1200, 800))
        assertTrue(compact.horizontalPadding < medium.horizontalPadding)
        assertTrue(medium.horizontalPadding < expanded.horizontalPadding)
        assertTrue(medium.contentMaxWidth < expanded.contentMaxWidth)
    }
}
