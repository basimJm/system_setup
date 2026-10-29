package com.acme.shop.designsystem.theme

import androidx.compose.runtime.Immutable

/** Opacity roles, so no component writes an alpha literal. */
@Immutable
data class AlphaTokens(
    val disabled: Float = 0.55f,
    val pressed: Float = 0.85f,
    val hover: Float = 0.08f,
    val border: Float = 1f,
    val overlayScrim: Float = 0.5f,
    val heroImageTint: Float = 0.65f,
)

val DefaultAlpha = AlphaTokens()
