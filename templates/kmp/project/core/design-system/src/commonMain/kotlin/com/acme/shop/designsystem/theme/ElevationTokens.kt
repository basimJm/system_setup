package com.acme.shop.designsystem.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Soft shadows from the design (`0 6px 18px` cards, `0 10px 24px` primary button, `0 16px 40px` dialogs). */
@Immutable
data class ElevationTokens(
    val none: Dp = 0.dp,
    val card: Dp = 6.dp,
    val raised: Dp = 10.dp,
    val overlay: Dp = 16.dp,
    val buttonShadowAlpha: Float = 0.28f,
    val cardShadowAlpha: Float = 0.06f,
    val logoShadowAlpha: Float = 0.30f,
)

val DefaultElevation = ElevationTokens()
