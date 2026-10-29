package com.acme.shop.designsystem.components.textfield

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import com.acme.shop.designsystem.components.button.AppIconButton
import com.acme.shop.designsystem.components.glass.glassBackground
import com.acme.shop.designsystem.components.text.AppText
import com.acme.shop.designsystem.icons.AppIcons
import com.acme.shop.designsystem.theme.AppTheme

/** Editable search bar with an optional filter button at End (All items screen). */
@Composable
fun AppSearchBar(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    filterDescription: String? = null,
    onFilterClick: (() -> Unit)? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8),
    ) {
        AppTextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = placeholder,
            modifier = Modifier.weight(1f),
            leading = {
                Icon(
                    imageVector = AppIcons.Search,
                    contentDescription = null,
                    tint = AppTheme.colors.faint,
                    modifier = Modifier.size(AppTheme.sizes.icon),
                )
            },
        )
        if (onFilterClick != null && filterDescription != null) {
            AppIconButton(AppIcons.Filter, filterDescription, onFilterClick, tint = AppTheme.colors.accent)
        }
    }
}

/** Non-editable search bar (Home): looks like the field and opens the search screen when tapped. */
@Composable
fun AppSearchBarStatic(
    placeholder: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = AppTheme.colors
    Row(
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = AppTheme.sizes.fieldHeight)
            .glassBackground(AppTheme.glass, AppTheme.shapes.medium)
            .clickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = AppTheme.spacing.space14),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8),
    ) {
        Icon(
            imageVector = AppIcons.Search,
            contentDescription = null,
            tint = colors.faint,
            modifier = Modifier.size(AppTheme.sizes.icon),
        )
        AppText(text = placeholder, style = AppTheme.typography.bodyLarge, color = colors.faint, maxLines = 1)
    }
}
