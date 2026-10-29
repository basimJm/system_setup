package com.acme.shop.designsystem.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** 2 dp base grid used by the design (padding 6, 10, 14 and 22 appear in the exports). */
@Immutable
data class SpacingTokens(
    val space0: Dp = 0.dp,
    val space2: Dp = 2.dp,
    val space4: Dp = 4.dp,
    val space6: Dp = 6.dp,
    val space8: Dp = 8.dp,
    val space10: Dp = 10.dp,
    val space12: Dp = 12.dp,
    val space14: Dp = 14.dp,
    val space16: Dp = 16.dp,
    val space20: Dp = 20.dp,
    val space24: Dp = 24.dp,
    val space28: Dp = 28.dp,
    val space32: Dp = 32.dp,
    val space40: Dp = 40.dp,
    val space48: Dp = 48.dp,
    val space64: Dp = 64.dp,
)

val DefaultSpacing = SpacingTokens()
