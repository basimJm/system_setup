package com.acme.shop.designsystem.components.dialog

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.acme.shop.designsystem.components.badge.StatusTone
import com.acme.shop.designsystem.components.badge.statusColors
import com.acme.shop.designsystem.components.button.AppOutlinedButton
import com.acme.shop.designsystem.components.button.AppPrimaryButton
import com.acme.shop.designsystem.components.glass.liquidGlass
import com.acme.shop.designsystem.components.glass.rememberGlass
import com.acme.shop.designsystem.components.text.AppText
import com.acme.shop.designsystem.icons.AppIcons
import com.acme.shop.designsystem.theme.AppTheme

/** Confirmation (confirm + dismiss), info (confirm only) and auth-required dialogs share this layout. */
@Composable
fun AppDialog(
    title: String,
    confirmText: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    message: String? = null,
    dismissText: String? = null,
    icon: ImageVector = AppIcons.Info,
    tone: StatusTone = StatusTone.Accent,
    dismissOnOutside: Boolean = true,
) {
    val spacing = AppTheme.spacing
    val (iconColor, iconContainer) = statusColors(tone, AppTheme.colors)
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(dismissOnBackPress = dismissOnOutside, dismissOnClickOutside = dismissOnOutside),
    ) {
        Column(
            modifier = modifier
                .widthIn(max = AppTheme.sizes.dialogMaxWidth)
                .fillMaxWidth()
                .liquidGlass(rememberGlass(), AppTheme.shapes.extraLarge)
                .padding(spacing.space24),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(spacing.space12),
        ) {
            Box(
                modifier = Modifier.size(AppTheme.sizes.dialogIcon).background(iconContainer, AppTheme.shapes.circle),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(AppTheme.sizes.iconLarge))
            }
            AppText(text = title, style = AppTheme.typography.titleLarge, textAlign = TextAlign.Center)
            if (message != null) {
                AppText(text = message, style = AppTheme.typography.bodyMedium, color = AppTheme.colors.muted, textAlign = TextAlign.Center)
            }
            AppPrimaryButton(text = confirmText, onClick = onConfirm, modifier = Modifier.fillMaxWidth())
            if (dismissText != null) {
                AppOutlinedButton(text = dismissText, onClick = onDismiss, modifier = Modifier.fillMaxWidth())
            }
        }
    }
}
