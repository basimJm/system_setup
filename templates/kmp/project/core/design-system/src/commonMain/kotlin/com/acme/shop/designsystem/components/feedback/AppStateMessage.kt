package com.acme.shop.designsystem.components.feedback

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import com.acme.shop.designsystem.components.button.AppPrimaryButton
import com.acme.shop.designsystem.components.text.AppText
import com.acme.shop.designsystem.icons.AppIcons
import com.acme.shop.designsystem.resources.Res
import com.acme.shop.designsystem.resources.state_empty_title
import com.acme.shop.designsystem.resources.state_error_message
import com.acme.shop.designsystem.resources.state_error_title
import com.acme.shop.designsystem.resources.state_offline_message
import com.acme.shop.designsystem.resources.state_offline_title
import com.acme.shop.designsystem.resources.state_retry
import com.acme.shop.designsystem.theme.AppTheme
import org.jetbrains.compose.resources.stringResource

/** Centered icon, title, message and optional action: the shared layout of empty, error and offline states. */
@Composable
fun AppStateMessage(
    icon: ImageVector,
    title: String,
    modifier: Modifier = Modifier,
    message: String? = null,
    actionText: String? = null,
    onAction: (() -> Unit)? = null,
) {
    val colors = AppTheme.colors
    val spacing = AppTheme.spacing
    Column(
        modifier = modifier.padding(spacing.space24),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(spacing.space12, Alignment.CenterVertically),
    ) {
        Icon(icon, contentDescription = null, tint = colors.accent, modifier = Modifier.size(AppTheme.sizes.stateIcon))
        AppText(text = title, style = AppTheme.typography.titleLarge, textAlign = TextAlign.Center)
        if (message != null) {
            AppText(text = message, style = AppTheme.typography.bodyMedium, color = colors.muted, textAlign = TextAlign.Center)
        }
        if (actionText != null && onAction != null) {
            AppPrimaryButton(text = actionText, onClick = onAction)
        }
    }
}

@Composable
fun AppOfflineState(onRetry: () -> Unit, modifier: Modifier = Modifier) {
    AppStateMessage(
        icon = AppIcons.Offline,
        title = stringResource(Res.string.state_offline_title),
        message = stringResource(Res.string.state_offline_message),
        actionText = stringResource(Res.string.state_retry),
        onAction = onRetry,
        modifier = modifier,
    )
}

/**
 * Error state with the handling path of [action] decides the button (retry by default); a login / contact /
 * update action goes through [onAction] when given, otherwise the button falls back to [onRetry].
 */
@Composable
fun AppErrorState(
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    message: String? = null,
    action: ErrorAction = ErrorAction.RETRY,
    onAction: ((ErrorAction) -> Unit)? = null,
) {
    val label = errorActionLabel(action)
    AppStateMessage(
        icon = AppIcons.Error,
        title = stringResource(Res.string.state_error_title),
        message = message ?: stringResource(Res.string.state_error_message),
        actionText = label?.let { stringResource(it) },
        onAction = label?.let { { onAction?.invoke(action) ?: onRetry() } },
        modifier = modifier,
    )
}

@Composable
fun AppEmptyState(
    modifier: Modifier = Modifier,
    title: String = stringResource(Res.string.state_empty_title),
    message: String? = null,
    actionText: String? = null,
    onAction: (() -> Unit)? = null,
) {
    AppStateMessage(AppIcons.SearchOff, title, modifier, message, actionText, onAction)
}

@Composable
fun AppLoadingIndicator(modifier: Modifier = Modifier) {
    CircularProgressIndicator(
        modifier = modifier.size(AppTheme.sizes.spinner),
        color = AppTheme.colors.accent,
        strokeWidth = AppTheme.sizes.spinnerStroke,
    )
}
