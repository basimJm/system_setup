package com.acme.shop.designsystem.components.badge

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import com.acme.shop.designsystem.components.text.AppText
import com.acme.shop.designsystem.theme.AppColors
import com.acme.shop.designsystem.theme.AppTheme

/** Meaning of a status pill: orders, payment, refund, team and items states all map onto these hues. */
enum class StatusTone { Success, Warning, Danger, Neutral, Accent }

/** Content color and tinted container for a tone. Pure, so it is unit tested. */
fun statusColors(tone: StatusTone, colors: AppColors): Pair<Color, Color> = when (tone) {
    StatusTone.Success -> colors.onSuccessContainer to colors.successContainer
    StatusTone.Warning -> colors.onWarningContainer to colors.warningContainer
    StatusTone.Danger -> colors.onDangerContainer to colors.dangerContainer
    StatusTone.Neutral -> colors.onNeutralContainer to colors.neutralContainer
    StatusTone.Accent -> colors.onAccentContainer to colors.accentContainer
}

@Composable
fun AppStatusBadge(
    text: String,
    tone: StatusTone,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
) {
    val (content, container) = statusColors(tone, AppTheme.colors)
    val spacing = AppTheme.spacing
    Row(
        modifier = modifier
            .defaultMinSize(minHeight = AppTheme.sizes.badgeHeight)
            .background(container, AppTheme.shapes.small)
            .padding(horizontal = spacing.space10, vertical = spacing.space4),
        horizontalArrangement = Arrangement.spacedBy(spacing.space4),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = content, modifier = Modifier.size(AppTheme.sizes.iconSmall))
        }
        AppText(text = text, style = AppTheme.typography.labelMedium, color = content, maxLines = 1)
    }
}

/** Text for the notification counter: nothing for 0 or less, the number up to [max], then "max+". */
fun countBadgeLabel(count: Int, max: Int = MAX_BADGE_COUNT): String? = when {
    count <= 0 -> null
    count > max -> "$max+"
    else -> count.toString()
}

private const val MAX_BADGE_COUNT = 99

@Composable
fun AppCountBadge(count: Int, modifier: Modifier = Modifier) {
    val label = countBadgeLabel(count) ?: return
    val colors = AppTheme.colors
    Box(
        modifier = modifier
            .defaultMinSize(minWidth = AppTheme.sizes.countBadge, minHeight = AppTheme.sizes.countBadge)
            .background(colors.danger, AppTheme.shapes.pill)
            .padding(horizontal = AppTheme.spacing.space4),
        contentAlignment = Alignment.Center,
    ) {
        AppText(text = label, style = AppTheme.typography.labelSmall, color = colors.onGradient, maxLines = 1)
    }
}
