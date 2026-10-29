package com.acme.shop.designsystem.theme

import androidx.compose.ui.graphics.Color

private val Violet = Color(0xFF6D28D9)
private val VioletLight = Color(0xFFA855F7)
private val Green = Color(0xFF2E9E78)
private val Amber = Color(0xFFF59E0B)
private val Pink = Color(0xFFD9467A)
private val Gray = Color(0xFF6B7280)

/** Light theme tokens (design `tv()` with theme = light). */
val LightColors = AppColors(
    isDark = false,
    background = Color(0xFFFFFFFF),
    card = Color(0xFFFFFFFF),
    surface = Violet.copy(alpha = 0.03f),
    soft = Violet.copy(alpha = 0.08f),
    line = Color(0xFFEEEAF4),
    scrim = Color(0x800A0814),
    ink = Color(0xFF1F2233),
    muted = Color(0xFF6B7280),
    faint = Color(0xFF9CA3AF),
    accent = Violet,
    onAccent = Color(0xFFFFFFFF),
    gradientStart = Violet,
    gradientEnd = VioletLight,
    onGradient = Color(0xFFFFFFFF),
    success = Green,
    successContainer = Green.copy(alpha = 0.12f),
    warning = Amber,
    warningContainer = Amber.copy(alpha = 0.14f),
    danger = Pink,
    dangerContainer = Pink.copy(alpha = 0.12f),
    neutral = Gray,
    neutralContainer = Gray.copy(alpha = 0.12f),
    accentContainer = Violet.copy(alpha = 0.10f),
    onSuccessContainer = Color(0xFF1B6F55),
    onWarningContainer = Color(0xFF8A5200),
    onDangerContainer = Color(0xFFB83268),
    onNeutralContainer = Color(0xFF545B68),
    onAccentContainer = Color(0xFF5B21B6),
    heroStart = Color(0xFFFFFFFF),
    heroMiddle = Color(0xFFF7F1FF),
    heroEnd = Color(0xFFECDDFC),
    shimmerBase = Violet.copy(alpha = 0.08f),
    shimmerHighlight = Color.White.copy(alpha = 0.6f),
    onMedia = Color(0xFFFFFFFF),
    shadow = Color(0xFF1F2233),
)
