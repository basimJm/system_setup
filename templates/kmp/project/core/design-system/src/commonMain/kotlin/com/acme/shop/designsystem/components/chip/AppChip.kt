package com.acme.shop.designsystem.components.chip

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import com.acme.shop.designsystem.components.glass.glassBackground
import com.acme.shop.designsystem.components.glass.glassClickable
import com.acme.shop.designsystem.components.glass.glassHighlight
import com.acme.shop.designsystem.components.glass.glassPressScale
import com.acme.shop.designsystem.components.glass.rememberContentGlass
import com.acme.shop.designsystem.components.glass.rememberGlassPress
import com.acme.shop.designsystem.components.text.AppText
import com.acme.shop.designsystem.icons.AppIcons
import com.acme.shop.designsystem.theme.AppTheme
import com.acme.shop.designsystem.theme.GlassStyle
import com.acme.shop.designsystem.utils.brandBackground
import com.acme.shop.designsystem.utils.brandBrush

/** Selectable filter chip. With [onRemove] it becomes an active-filter chip with a remove (x) action. */
@Composable
fun AppFilterChip(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    removeDescription: String? = null,
    onRemove: (() -> Unit)? = null,
) {
    val colors = AppTheme.colors
    val spacing = AppTheme.spacing
    val shape = AppTheme.shapes.small
    val glass = rememberContentGlass()
    val press = rememberGlassPress()
    val background = if (selected) {
        Modifier.brandBackground(brandBrush(), shape).glassHighlight(glass, shape)
    } else {
        Modifier.glassBackground(AppTheme.glass, shape, GlassStyle.Subtle)
    }
    val content = if (selected) colors.onGradient else colors.accent
    Row(
        modifier = modifier
            .glassPressScale(press)
            .defaultMinSize(minHeight = AppTheme.sizes.chipHeight)
            .then(background)
            .semantics { this.selected = selected }
            .glassClickable(press, onClick = onClick)
            .padding(horizontal = spacing.space12, vertical = spacing.space6),
        horizontalArrangement = Arrangement.spacedBy(spacing.space6),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AppText(text = text, style = AppTheme.typography.labelMedium, color = content, maxLines = 1)
        if (onRemove != null) {
            Icon(
                imageVector = AppIcons.Close,
                contentDescription = removeDescription,
                tint = content,
                modifier = Modifier
                    .size(AppTheme.sizes.iconSmall)
                    .clickable(role = Role.Button, onClick = onRemove),
            )
        }
    }
}

enum class SlotState { Available, Selected, Full }

/** Time slot in the orders grid: available, selected or full (disabled, with the caller's "full" label). */
@Composable
fun AppTimeSlotChip(
    time: String,
    state: SlotState,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    fullLabel: String? = null,
) {
    val colors = AppTheme.colors
    val shape = AppTheme.shapes.small
    val selected = state == SlotState.Selected
    val full = state == SlotState.Full
    val glass = rememberContentGlass()
    val press = rememberGlassPress()
    val background = if (selected) {
        Modifier.brandBackground(brandBrush(), shape).glassHighlight(glass, shape)
    } else {
        Modifier.glassBackground(AppTheme.glass, shape, GlassStyle.Subtle)
    }
    val content = when {
        selected -> colors.onGradient
        full -> colors.faint
        else -> colors.accent
    }
    Row(
        modifier = modifier
            .glassPressScale(press)
            .defaultMinSize(minWidth = AppTheme.sizes.timeSlotWidth, minHeight = AppTheme.sizes.touchTarget)
            .then(background)
            .alpha(if (full) AppTheme.alpha.disabled else 1f)
            .semantics { this.selected = selected }
            .glassClickable(press, enabled = !full, onClick = onClick)
            .padding(horizontal = AppTheme.spacing.space12, vertical = AppTheme.spacing.space8),
        horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space4, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val label = if (full && fullLabel != null) fullLabel else time
        AppText(text = label, style = AppTheme.typography.labelMedium, color = content, maxLines = 1)
    }
}
