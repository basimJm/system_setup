package com.acme.shop.designsystem.components.selector

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import com.acme.shop.designsystem.theme.AppTheme
import com.acme.shop.designsystem.utils.brandBackground
import com.acme.shop.designsystem.utils.brandBrush

/** Two to four equal tabs in a soft track (segment tabs, upcoming/past orders). Order follows the layout direction. */
@Composable
fun AppSegmentedTabs(
    tabs: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = AppTheme.colors
    val spacing = AppTheme.spacing
    val shape = AppTheme.shapes.medium
    val glass = rememberContentGlass()
    Row(
        modifier = modifier
            .fillMaxWidth()
            .glassBackground(AppTheme.glass, shape)
            .padding(spacing.space4),
    ) {
        tabs.forEachIndexed { index, label ->
            val selected = index == selectedIndex
            val tabShape = AppTheme.shapes.small
            val press = rememberGlassPress()
            Box(
                modifier = Modifier
                    .weight(1f)
                    .glassPressScale(press)
                    .defaultMinSize(minHeight = AppTheme.sizes.touchTarget - spacing.space8)
                    .then(if (selected) Modifier.brandBackground(brandBrush(), tabShape).glassHighlight(glass, tabShape) else Modifier)
                    .semantics { this.selected = selected }
                    .glassClickable(press, role = Role.Tab) { onSelect(index) }
                    .padding(vertical = spacing.space8),
                contentAlignment = Alignment.Center,
            ) {
                AppText(
                    text = label,
                    style = AppTheme.typography.labelLarge,
                    color = if (selected) colors.onGradient else colors.accent,
                    maxLines = 1,
                )
            }
        }
    }
}
