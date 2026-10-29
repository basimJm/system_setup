package com.acme.shop.designsystem.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.unit.LayoutDirection
import com.acme.shop.core.ui.utils.LocalDarkTheme

/** Material scheme built from roles, so any stock Material component still looks like . */
internal fun AppColors.toMaterialScheme(): ColorScheme {
    val base = if (isDark) darkColorScheme() else lightColorScheme()
    return base.copy(
        primary = accent,
        onPrimary = onAccent,
        primaryContainer = accentContainer,
        onPrimaryContainer = accent,
        secondary = gradientEnd,
        onSecondary = onGradient,
        background = background,
        onBackground = ink,
        surface = card,
        onSurface = ink,
        surfaceVariant = surface,
        onSurfaceVariant = muted,
        surfaceTint = accent,
        error = danger,
        onError = onGradient,
        errorContainer = dangerContainer,
        onErrorContainer = danger,
        outline = muted,
        outlineVariant = line,
        scrim = scrim,
        surfaceContainerLowest = background,
        surfaceContainerLow = card,
        surfaceContainer = card,
        surfaceContainerHigh = card,
        surfaceContainerHighest = surface,
    )
}

@Composable
fun rememberAppWindowSize(): AppWindowSize {
    val container = LocalWindowInfo.current.containerSize
    val density = LocalDensity.current
    return remember(container, density) {
        with(density) { AppWindowSize(width = container.width.toDp(), height = container.height.toDp()) }
    }
}

/**
 * The theme. Dark/light comes from [LocalDarkTheme] (Light / Dark / System is resolved by the app shell);
 * Arabic fonts follow the layout direction (Arabic = RTL).
 */
@Composable
fun AppTheme(
    darkTheme: Boolean = LocalDarkTheme.current,
    windowSize: AppWindowSize = rememberAppWindowSize(),
    content: @Composable () -> Unit,
) {
    val colors = if (darkTheme) DarkColors else LightColors
    val fonts = rememberAppFontFamilies(arabic = LocalLayoutDirection.current == LayoutDirection.Rtl)
    val typography = remember(fonts) { appTypography(fonts.headline, fonts.body) }
    val scheme = remember(colors) { colors.toMaterialScheme() }
    val adaptive = remember(windowSize) { adaptiveFor(windowSize) }
    val glass = remember(colors) { glassTokensFor(colors) }
    CompositionLocalProvider(
        LocalDarkTheme provides darkTheme,
        LocalAppColors provides colors,
        LocalTypography provides typography,
        LocalAdaptive provides adaptive,
        LocalGlass provides glass,
    ) {
        MaterialTheme(colorScheme = scheme, typography = typography.toMaterialTypography(), content = content)
    }
}

/** Short accessors: `AppTheme.colors`, `AppTheme.spacing`... for use inside composables. */
object AppTheme {
    val colors: AppColors @Composable get() = LocalAppColors.current
    val spacing: SpacingTokens @Composable get() = LocalSpacing.current
    val shapes: ShapeTokens @Composable get() = LocalShapes.current
    val sizes: SizeTokens @Composable get() = LocalSizes.current
    val elevation: ElevationTokens @Composable get() = LocalElevation.current
    val alpha: AlphaTokens @Composable get() = LocalAlpha.current
    val motion: MotionTokens @Composable get() = LocalMotion.current
    val typography: TypographyTokens @Composable get() = LocalTypography.current
    val adaptive: AdaptiveTokens @Composable get() = LocalAdaptive.current
    val glass: GlassTokens @Composable get() = LocalGlass.current
}
