package com.acme.shop.designsystem.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

enum class WidthClass { Compact, Medium, Expanded }

enum class HeightClass { Compact, Medium, Expanded }

enum class AppOrientation { Portrait, Landscape }

enum class NavigationStyle { BottomBar, Rail }

/** Window breakpoints (Material 3 window size classes). */
object Breakpoints {
    val mediumWidth: Dp = 600.dp
    val expandedWidth: Dp = 840.dp
    val mediumHeight: Dp = 480.dp
    val expandedHeight: Dp = 900.dp
}

/** The current window in dp; classes are derived, so they update on rotation and split-screen changes. */
@Immutable
data class AppWindowSize(val width: Dp, val height: Dp) {
    val widthClass: WidthClass
        get() = when {
            width < Breakpoints.mediumWidth -> WidthClass.Compact
            width < Breakpoints.expandedWidth -> WidthClass.Medium
            else -> WidthClass.Expanded
        }
    val heightClass: HeightClass
        get() = when {
            height < Breakpoints.mediumHeight -> HeightClass.Compact
            height < Breakpoints.expandedHeight -> HeightClass.Medium
            else -> HeightClass.Expanded
        }
    val orientation: AppOrientation
        get() = if (width > height) AppOrientation.Landscape else AppOrientation.Portrait
    val isLandscape: Boolean get() = orientation == AppOrientation.Landscape
}

/** Layout decisions derived from the window: one place decides columns, margins and navigation. */
@Immutable
data class AdaptiveTokens(
    val window: AppWindowSize,
    val navigation: NavigationStyle,
    val horizontalPadding: Dp,
    val contentMaxWidth: Dp,
    val gridColumns: Int,
    val twoPane: Boolean,
    /** Columns of the Instagram-style gallery grid (item 11). */
    val galleryColumns: Int = GALLERY_COLUMNS_COMPACT,
)

private val CompactPadding = 16.dp
private val MediumPadding = 24.dp
private val ExpandedPadding = 32.dp
private val NoMaxWidth = Dp.Infinity
private const val SINGLE_COLUMN = 1
private const val DOUBLE_COLUMN = 2
private const val TRIPLE_COLUMN = 3
private const val GALLERY_COLUMNS_COMPACT = 3
private const val GALLERY_COLUMNS_MEDIUM = 4
private const val GALLERY_COLUMNS_EXPANDED = 6

fun adaptiveFor(window: AppWindowSize): AdaptiveTokens = when (window.widthClass) {
    WidthClass.Compact -> AdaptiveTokens(
        window = window,
        navigation = NavigationStyle.BottomBar,
        horizontalPadding = CompactPadding,
        contentMaxWidth = NoMaxWidth,
        gridColumns = SINGLE_COLUMN,
        twoPane = false,
        galleryColumns = GALLERY_COLUMNS_COMPACT,
    )
    WidthClass.Medium -> AdaptiveTokens(
        window = window,
        navigation = NavigationStyle.Rail,
        horizontalPadding = MediumPadding,
        contentMaxWidth = Breakpoints.mediumWidth,
        gridColumns = DOUBLE_COLUMN,
        twoPane = false,
        galleryColumns = GALLERY_COLUMNS_MEDIUM,
    )
    WidthClass.Expanded -> AdaptiveTokens(
        window = window,
        navigation = NavigationStyle.Rail,
        horizontalPadding = ExpandedPadding,
        contentMaxWidth = Breakpoints.expandedWidth,
        gridColumns = TRIPLE_COLUMN,
        twoPane = true,
        galleryColumns = GALLERY_COLUMNS_EXPANDED,
    )
}
