package com.acme.shop.designsystem.components.section

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import com.acme.shop.designsystem.components.text.AppText
import com.acme.shop.designsystem.theme.AppTheme

/** Section title at Start and an optional "see more / see all" action at End (shown only when there is more to see). */
@Composable
fun AppSectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    actionText: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AppText(text = title, style = AppTheme.typography.headlineSmall, maxLines = 1, modifier = Modifier.weight(1f))
        if (actionText != null && onAction != null) {
            AppText(
                text = actionText,
                style = AppTheme.typography.labelMedium,
                color = AppTheme.colors.accent,
                modifier = Modifier.clickable(role = Role.Button, onClick = onAction),
            )
        }
    }
}
