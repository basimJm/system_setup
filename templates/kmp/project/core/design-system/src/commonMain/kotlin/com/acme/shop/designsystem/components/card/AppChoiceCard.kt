package com.acme.shop.designsystem.components.card

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextAlign
import com.acme.shop.designsystem.components.text.AppText
import com.acme.shop.designsystem.theme.AppTheme

/** One option of a single-choice group (segment): icon over label, accent border and soft fill when selected. */
@Composable
fun AppChoiceCard(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
) {
    val colors = AppTheme.colors
    val shape = AppTheme.shapes.large
    val tint = if (selected) colors.accent else colors.ink
    Column(
        modifier = modifier
            .height(AppTheme.sizes.choiceCardHeight)
            .clip(shape)
            .background(if (selected) colors.soft else colors.card)
            .border(AppTheme.sizes.borderWidth, if (selected) colors.accent else colors.line, shape)
            .selectable(selected = selected, role = Role.RadioButton, onClick = onClick)
            .padding(AppTheme.spacing.space12),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8, Alignment.CenterVertically),
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.height(AppTheme.sizes.iconLarge))
        }
        AppText(text = label, style = AppTheme.typography.titleSmall, color = tint, textAlign = TextAlign.Center)
    }
}
