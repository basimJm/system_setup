package com.acme.shop.designsystem.components.shimmer

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import com.acme.shop.designsystem.theme.AppTheme

private const val SHIMMER_BANDS = 3f

/** Looping 0..1 progress shared by every placeholder of a screen. */
@Composable
fun rememberShimmerProgress(): State<Float> {
    val transition = rememberInfiniteTransition(label = "shimmer")
    return transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(AppTheme.motion.shimmerCycle, easing = LinearEasing), RepeatMode.Restart),
        label = "shimmerProgress",
    )
}

/** Paints the moving highlight. [progress] is read in the draw phase, so animating never recomposes. */
fun Modifier.shimmerFill(progress: () -> Float, base: Color, highlight: Color): Modifier = drawBehind {
    val band = size.width
    val start = -band + progress() * band * SHIMMER_BANDS
    drawRect(
        Brush.linearGradient(
            colors = listOf(base, highlight, base),
            start = Offset(start, 0f),
            end = Offset(start + band, 0f),
        ),
    )
}

/** A shimmering block shaped like the content it stands for (card, avatar, text line). */
@Composable
fun AppShimmerBox(
    modifier: Modifier = Modifier,
    shape: Shape = AppTheme.shapes.small,
) {
    val colors = AppTheme.colors
    val progress = rememberShimmerProgress()
    Box(modifier = modifier.clip(shape).shimmerFill({ progress.value }, colors.shimmerBase, colors.shimmerHighlight))
}

@Composable
fun AppShimmerLine(
    modifier: Modifier = Modifier,
    height: Dp = AppTheme.sizes.shimmerLine,
) {
    AppShimmerBox(modifier = modifier.fillMaxWidth().height(height))
}
