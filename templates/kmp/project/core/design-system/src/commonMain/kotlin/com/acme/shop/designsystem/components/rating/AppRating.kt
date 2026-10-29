package com.acme.shop.designsystem.components.rating

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import com.acme.shop.designsystem.icons.AppIcons
import com.acme.shop.designsystem.resources.Res
import com.acme.shop.designsystem.resources.rating_description
import com.acme.shop.designsystem.theme.AppTheme
import org.jetbrains.compose.resources.stringResource

@Composable
private fun Star(fill: Float, size: Dp, modifier: Modifier = Modifier) {
    val colors = AppTheme.colors
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    Box(modifier = modifier.size(size)) {
        Icon(AppIcons.Star, contentDescription = null, tint = colors.line, modifier = Modifier.size(size))
        Icon(
            imageVector = AppIcons.Star,
            contentDescription = null,
            tint = colors.warning,
            modifier = Modifier
                .size(size)
                .drawWithContent {
                    // Partial stars fill from the Start side, which is the right side in RTL.
                    val width = this.size.width
                    val left = if (rtl) width * (1f - fill) else 0f
                    val right = if (rtl) width else width * fill
                    clipRect(left = left, right = right) { this@drawWithContent.drawContent() }
                },
        )
    }
}

/** Read-only rating (supports decimals such as 4.5). */
@Composable
fun AppRatingStars(
    rating: Float,
    modifier: Modifier = Modifier,
    starSize: Dp = AppTheme.sizes.ratingStar,
) {
    val description = stringResource(Res.string.rating_description, rating.toString(), RATING_MAX_STARS)
    Row(
        modifier = modifier.semantics { contentDescription = description },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        repeat(RATING_MAX_STARS) { index -> Star(fill = starFill(index, rating), size = starSize) }
    }
}

/** Tap-to-rate input, 1 to 5. */
@Composable
fun AppRatingInput(
    value: Int,
    onValueChange: (Int) -> Unit,
    modifier: Modifier = Modifier,
    starSize: Dp = AppTheme.sizes.ratingStarLarge,
) {
    val description = stringResource(Res.string.rating_description, value.toString(), RATING_MAX_STARS)
    Row(
        modifier = modifier.semantics { contentDescription = description },
        horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        repeat(RATING_MAX_STARS) { index ->
            Star(
                fill = starFill(index, value.toFloat()),
                size = starSize,
                modifier = Modifier.clickable(role = Role.Button) { onValueChange(index + 1) },
            )
        }
    }
}
