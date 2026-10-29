package com.acme.shop.designsystem.theme

import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.unit.dp

val LocalAppColors = staticCompositionLocalOf { LightColors }
val LocalSpacing = staticCompositionLocalOf { DefaultSpacing }
val LocalShapes = staticCompositionLocalOf { DefaultShapes }
val LocalSizes = staticCompositionLocalOf { DefaultSizes }
val LocalElevation = staticCompositionLocalOf { DefaultElevation }
val LocalAlpha = staticCompositionLocalOf { DefaultAlpha }
val LocalGlass = staticCompositionLocalOf { DefaultGlass }
val LocalMotion = staticCompositionLocalOf { DefaultMotion }
val LocalTypography = staticCompositionLocalOf<TypographyTokens> { error("AppTheme is missing") }
val LocalAdaptive = compositionLocalOf { adaptiveFor(AppWindowSize(width = 390.dp, height = 844.dp)) }
