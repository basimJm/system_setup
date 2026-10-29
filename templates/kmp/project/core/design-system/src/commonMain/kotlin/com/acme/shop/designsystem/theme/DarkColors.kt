package com.acme.shop.designsystem.theme

import androidx.compose.ui.graphics.Color

private val Violet = Color(0xFF6D28D9)
private val VioletLight = Color(0xFFA855F7)
private val Lilac = Color(0xFFC9AEF7)
private val Green = Color(0xFF3FBF94)
private val Amber = Color(0xFFF5A524)
private val Pink = Color(0xFFF0689A)
private val Gray = Color(0xFFB6BBCB)

/** Dark theme tokens (design `tv()` with theme = dark). */
val DarkColors = AppColors(
    isDark = true,
    background = Color(0xFF14172B),
    card = Color(0xFF1C1F37),
    surface = Lilac.copy(alpha = 0.05f),
    soft = Lilac.copy(alpha = 0.12f),
    line = Color(0x17FFFFFF),
    scrim = Color(0xB3000000),
    ink = Color(0xFFF8FAFC),
    muted = Color(0xFFB6BBCB),
    faint = Color(0xFF8A90A6),
    accent = Lilac,
    onAccent = Color(0xFF14172B),
    gradientStart = Violet,
    gradientEnd = VioletLight,
    onGradient = Color(0xFFFFFFFF),
    success = Green,
    successContainer = Green.copy(alpha = 0.16f),
    warning = Amber,
    warningContainer = Amber.copy(alpha = 0.18f),
    danger = Pink,
    dangerContainer = Pink.copy(alpha = 0.16f),
    neutral = Gray,
    neutralContainer = Gray.copy(alpha = 0.16f),
    accentContainer = Lilac.copy(alpha = 0.14f),
    onSuccessContainer = Green,
    onWarningContainer = Amber,
    onDangerContainer = Color(0xFFF58AB1),
    onNeutralContainer = Gray,
    onAccentContainer = Lilac,
    heroStart = Color(0xFF14172B),
    heroMiddle = Color(0xFF1B1030),
    heroEnd = Color(0xFF2A1450),
    shimmerBase = Lilac.copy(alpha = 0.08f),
    shimmerHighlight = Lilac.copy(alpha = 0.16f),
    onMedia = Color(0xFFFFFFFF),
    shadow = Color(0xFF000000),
)
