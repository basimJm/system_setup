package com.acme.shop.designsystem.utils

import androidx.compose.foundation.background
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import com.acme.shop.designsystem.theme.AppTheme

/** Brand gradient (violet to light violet) used by primary actions and selected states. */
@Composable
fun brandBrush(): Brush {
    val colors = AppTheme.colors
    return Brush.linearGradient(listOf(colors.gradientStart, colors.gradientEnd))
}

fun Modifier.brandBackground(brush: Brush, shape: Shape): Modifier = clip(shape).background(brush)

fun Modifier.softShadow(elevation: Dp, color: Color, shape: Shape): Modifier =
    shadow(elevation = elevation, shape = shape, ambientColor = color, spotColor = color)
