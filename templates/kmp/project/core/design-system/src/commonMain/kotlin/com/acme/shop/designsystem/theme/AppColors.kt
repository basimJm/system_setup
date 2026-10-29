package com.acme.shop.designsystem.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

/**
 * color roles. Values come from the design export (the `design` folder exports): violet brand, ink/muted/faint text
 * ramps, soft tinted fills, hairline borders and the four status hues. Components read roles, never raw colors.
 */
@Immutable
data class AppColors(
    val isDark: Boolean,
    // Surfaces
    val background: Color,
    val card: Color,
    val surface: Color,
    val soft: Color,
    val line: Color,
    val scrim: Color,
    // Text and icons
    val ink: Color,
    val muted: Color,
    val faint: Color,
    // Brand
    val accent: Color,
    val onAccent: Color,
    val gradientStart: Color,
    val gradientEnd: Color,
    val onGradient: Color,
    // Status hues and their tinted containers
    val success: Color,
    val successContainer: Color,
    val warning: Color,
    val warningContainer: Color,
    val danger: Color,
    val dangerContainer: Color,
    val neutral: Color,
    val neutralContainer: Color,
    val accentContainer: Color,
    // Text and icons on the tinted containers above (meets 4.5:1 contrast)
    val onSuccessContainer: Color,
    val onWarningContainer: Color,
    val onDangerContainer: Color,
    val onNeutralContainer: Color,
    val onAccentContainer: Color,
    // Auth / hero backdrop (top to bottom)
    val heroStart: Color,
    val heroMiddle: Color,
    val heroEnd: Color,
    // Loading shimmer
    val shimmerBase: Color,
    val shimmerHighlight: Color,
    // Media overlay text, shadows
    val onMedia: Color,
    val shadow: Color,
)
