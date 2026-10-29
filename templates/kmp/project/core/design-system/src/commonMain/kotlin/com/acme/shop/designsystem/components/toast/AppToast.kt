package com.acme.shop.designsystem.components.toast

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.acme.shop.designsystem.components.badge.StatusTone
import com.acme.shop.designsystem.components.badge.statusColors
import com.acme.shop.designsystem.components.glass.liquidGlass
import com.acme.shop.designsystem.components.glass.rememberGlass
import com.acme.shop.designsystem.components.text.AppText
import com.acme.shop.designsystem.icons.AppIcons
import com.acme.shop.designsystem.theme.AppTheme

/** Toast / snackbar body with success, error and info variants (the host that shows and hides it lives in core/notification). */
@Composable
fun AppToast(
    message: String,
    tone: StatusTone,
    modifier: Modifier = Modifier,
) {
    val (content, container) = statusColors(tone, AppTheme.colors)
    val icon = when (tone) {
        StatusTone.Success -> AppIcons.Check
        StatusTone.Danger -> AppIcons.Error
        else -> AppIcons.Info
    }
    Row(
        modifier = modifier
            .fillMaxWidth()
            .liquidGlass(rememberGlass(), AppTheme.shapes.medium)
            .background(container.copy(alpha = container.alpha * AppTheme.glass.tintAlpha), AppTheme.shapes.medium)
            .padding(AppTheme.spacing.space12),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8),
    ) {
        Icon(icon, contentDescription = null, tint = content, modifier = Modifier.size(AppTheme.sizes.icon))
        AppText(text = message, style = AppTheme.typography.bodyMedium, color = AppTheme.colors.ink)
    }
}
