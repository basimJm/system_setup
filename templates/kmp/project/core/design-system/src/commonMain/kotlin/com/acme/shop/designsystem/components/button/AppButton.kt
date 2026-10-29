package com.acme.shop.designsystem.components.button

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import com.acme.shop.designsystem.components.glass.glassBackground
import com.acme.shop.designsystem.components.glass.glassClickable
import com.acme.shop.designsystem.components.glass.glassHighlight
import com.acme.shop.designsystem.components.glass.glassPressScale
import com.acme.shop.designsystem.components.glass.rememberContentGlass
import com.acme.shop.designsystem.components.glass.rememberGlassPress
import com.acme.shop.designsystem.components.text.AppText
import com.acme.shop.designsystem.theme.AppTheme
import com.acme.shop.designsystem.utils.brandBackground
import com.acme.shop.designsystem.utils.brandBrush
import com.acme.shop.designsystem.utils.softShadow

/** Visual weight of a button; the layout, height, shape and states are shared. */
enum class ButtonKind { Primary, Secondary, Outlined, Text, Destructive }

/** Labels wrap to a second line instead of truncating (narrow cards, 200 % font scale). */
private const val BUTTON_MAX_LINES = 2

@Composable
fun AppPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    leadingIcon: ImageVector? = null,
) = AppButton(text, onClick, modifier, ButtonKind.Primary, enabled, loading, leadingIcon)

@Composable
fun AppSecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    leadingIcon: ImageVector? = null,
) = AppButton(text, onClick, modifier, ButtonKind.Secondary, enabled, false, leadingIcon)

@Composable
fun AppOutlinedButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    leadingIcon: ImageVector? = null,
) = AppButton(text, onClick, modifier, ButtonKind.Outlined, enabled, false, leadingIcon)

@Composable
fun AppTextButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) = AppButton(text, onClick, modifier, ButtonKind.Text, enabled, false, null)

@Composable
fun AppDestructiveButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) = AppButton(text, onClick, modifier, ButtonKind.Destructive, enabled, false, null)

/** One button implementation: enabled, disabled and loading states for every [ButtonKind]. */
@Composable
fun AppButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    kind: ButtonKind = ButtonKind.Primary,
    enabled: Boolean = true,
    loading: Boolean = false,
    leadingIcon: ImageVector? = null,
) {
    val colors = AppTheme.colors
    val sizes = AppTheme.sizes
    val spacing = AppTheme.spacing
    val shape = AppTheme.shapes.medium
    val active = enabled && !loading
    val brush = brandBrush()
    val contentColor = buttonContentColor(kind, active)
    val glass = rememberContentGlass()
    val container = Modifier
        .defaultMinSize(minHeight = sizes.buttonHeight)
        .let { base ->
            when {
                kind == ButtonKind.Primary && active ->
                    base.softShadow(AppTheme.elevation.raised, colors.accent.copy(alpha = AppTheme.elevation.buttonShadowAlpha), shape)
                        .brandBackground(brush, shape)
                        .glassHighlight(glass, shape)
                kind == ButtonKind.Primary -> base.clip(shape).background(colors.soft)
                kind == ButtonKind.Secondary -> base.glassBackground(AppTheme.glass, shape)
                kind == ButtonKind.Destructive -> base.clip(shape).background(colors.dangerContainer)
                kind == ButtonKind.Outlined -> base.glassBackground(AppTheme.glass, shape)
                else -> base.clip(shape)
            }
        }
    val press = rememberGlassPress()
    Row(
        modifier = modifier
            .glassPressScale(press)
            .defaultMinSize(minHeight = sizes.touchTarget)
            .then(container)
            .alpha(if (enabled) 1f else AppTheme.alpha.disabled)
            .glassClickable(press, enabled = active, onClick = onClick)
            .padding(horizontal = spacing.space20, vertical = spacing.space12),
        horizontalArrangement = Arrangement.spacedBy(spacing.space8, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(sizes.spinner),
                color = contentColor,
                strokeWidth = sizes.spinnerStroke,
            )
        } else {
            if (leadingIcon != null) {
                Icon(leadingIcon, contentDescription = null, tint = contentColor, modifier = Modifier.size(sizes.icon))
            }
            AppText(
                text = text,
                style = AppTheme.typography.labelLarge,
                color = contentColor,
                maxLines = BUTTON_MAX_LINES,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun buttonContentColor(kind: ButtonKind, active: Boolean): Color {
    val colors = AppTheme.colors
    return when {
        kind == ButtonKind.Primary && active -> colors.onGradient
        kind == ButtonKind.Primary -> colors.faint
        kind == ButtonKind.Destructive -> colors.danger
        else -> colors.accent
    }
}

@Composable
fun AppIconButton(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    tint: Color = AppTheme.colors.ink,
    size: Dp = AppTheme.sizes.touchTarget,
) {
    val press = rememberGlassPress()
    Row(
        modifier = modifier
            .glassPressScale(press)
            .size(size)
            .glassClickable(press, enabled = enabled, onClick = onClick)
            .padding(AppTheme.spacing.space4)
            .glassBackground(AppTheme.glass, AppTheme.shapes.circle)
            .alpha(if (enabled) 1f else AppTheme.alpha.disabled),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = contentDescription, tint = tint, modifier = Modifier.size(AppTheme.sizes.iconLarge))
    }
}
