package com.acme.shop.designsystem.theme

import androidx.compose.material3.Typography
import androidx.compose.runtime.Immutable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp

/**
 * Type scale from the design: Playfair Display headings and Poppins body in English, IBM Plex Sans Arabic for
 * everything in Arabic. Sizes are `sp`, so they follow the system font scale.
 */
@Immutable
data class TypographyTokens(
    val display: TextStyle,
    val headlineLarge: TextStyle,
    val headlineMedium: TextStyle,
    val headlineSmall: TextStyle,
    val titleLarge: TextStyle,
    val titleMedium: TextStyle,
    val titleSmall: TextStyle,
    val bodyLarge: TextStyle,
    val bodyMedium: TextStyle,
    val bodySmall: TextStyle,
    val labelLarge: TextStyle,
    val labelMedium: TextStyle,
    val labelSmall: TextStyle,
    /** "" serif wordmark under the logo (26 sp, letter-spacing .5). */
    val wordmark: TextStyle,
    /** "WEDDING & BEAUTY" tagline (10.5 sp, letter-spacing 2, semibold). */
    val tagline: TextStyle,
)

private fun style(family: FontFamily, weight: FontWeight, size: TextUnit, lineHeight: TextUnit) = TextStyle(
    fontFamily = family,
    fontWeight = weight,
    fontSize = size,
    lineHeight = lineHeight,
    textDirection = TextDirection.Content,
)

fun appTypography(headline: FontFamily, body: FontFamily) = TypographyTokens(
    display = style(headline, FontWeight.Bold, 32.sp, 42.sp),
    headlineLarge = style(headline, FontWeight.Bold, 26.sp, 36.sp),
    headlineMedium = style(headline, FontWeight.Bold, 22.sp, 32.sp),
    headlineSmall = style(headline, FontWeight.SemiBold, 19.sp, 28.sp),
    titleLarge = style(body, FontWeight.Bold, 18.sp, 26.sp),
    titleMedium = style(body, FontWeight.SemiBold, 16.sp, 24.sp),
    titleSmall = style(body, FontWeight.SemiBold, 14.sp, 22.sp),
    bodyLarge = style(body, FontWeight.Normal, 16.sp, 24.sp),
    bodyMedium = style(body, FontWeight.Normal, 14.sp, 22.sp),
    bodySmall = style(body, FontWeight.Normal, 12.sp, 18.sp),
    labelLarge = style(body, FontWeight.SemiBold, 15.sp, 22.sp),
    labelMedium = style(body, FontWeight.SemiBold, 12.sp, 18.sp),
    labelSmall = style(body, FontWeight.SemiBold, 11.sp, 16.sp),
    wordmark = style(headline, FontWeight.Bold, 26.sp, 32.sp).copy(letterSpacing = 0.5.sp),
    tagline = style(body, FontWeight.SemiBold, 10.5.sp, 14.sp).copy(letterSpacing = 2.sp),
)

/** Material text styles mapped from styles, so stock Material components use the bundled fonts. */
fun TypographyTokens.toMaterialTypography() = Typography(
    displayLarge = display,
    headlineLarge = headlineLarge,
    headlineMedium = headlineMedium,
    headlineSmall = headlineSmall,
    titleLarge = titleLarge,
    titleMedium = titleMedium,
    titleSmall = titleSmall,
    bodyLarge = bodyLarge,
    bodyMedium = bodyMedium,
    bodySmall = bodySmall,
    labelLarge = labelLarge,
    labelMedium = labelMedium,
    labelSmall = labelSmall,
)
