package com.acme.shop.designsystem.components.textfield

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import com.acme.shop.designsystem.components.glass.glassBackground
import com.acme.shop.designsystem.components.text.AppText
import com.acme.shop.designsystem.icons.AppIcons
import com.acme.shop.designsystem.theme.AppTheme

/** Dropdown with the same states as the text field: default, open, selected, disabled and error. */
@Composable
fun AppDropdownField(
    options: List<String>,
    selectedIndex: Int?,
    onSelect: (Int) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    label: String? = null,
    error: String? = null,
    enabled: Boolean = true,
) {
    var expanded by remember { mutableStateOf(false) }
    val colors = AppTheme.colors
    val spacing = AppTheme.spacing
    val selected = selectedIndex?.let { options.getOrNull(it) }
    val borderColor = if (error != null) colors.danger else Color.Transparent
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(spacing.space6)) {
        if (label != null) {
            AppText(text = label, style = AppTheme.typography.labelMedium, color = colors.muted)
        }
        Box {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .defaultMinSize(minHeight = AppTheme.sizes.fieldHeight)
                    .alpha(if (enabled) 1f else AppTheme.alpha.disabled)
                    .glassBackground(AppTheme.glass, AppTheme.shapes.medium)
                    .border(AppTheme.sizes.borderWidth, borderColor, AppTheme.shapes.medium)
                    .clickable(enabled = enabled, role = Role.DropdownList) { expanded = true }
                    .padding(horizontal = spacing.space14),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                AppText(
                    text = selected ?: placeholder,
                    style = AppTheme.typography.bodyLarge,
                    color = if (selected != null) colors.ink else colors.faint,
                    maxLines = 1,
                    modifier = Modifier.weight(1f),
                )
                Icon(
                    imageVector = AppIcons.ExpandMore,
                    contentDescription = null,
                    tint = colors.muted,
                    modifier = Modifier.size(AppTheme.sizes.iconLarge),
                )
            }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }, containerColor = colors.card) {
                options.forEachIndexed { index, option ->
                    DropdownMenuItem(
                        text = {
                            val color = if (index == selectedIndex) colors.accent else colors.ink
                            AppText(text = option, style = AppTheme.typography.bodyMedium, color = color)
                        },
                        onClick = {
                            expanded = false
                            onSelect(index)
                        },
                    )
                }
            }
        }
        if (error != null) {
            AppText(text = error, style = AppTheme.typography.bodySmall, color = colors.danger)
        }
    }
}
