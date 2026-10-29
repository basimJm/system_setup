package com.acme.shop.designsystem.components.dialog

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.acme.shop.designsystem.components.button.AppIconButton
import com.acme.shop.designsystem.components.text.AppText
import com.acme.shop.designsystem.icons.AppIcons
import com.acme.shop.designsystem.resources.Res
import com.acme.shop.designsystem.resources.common_close
import com.acme.shop.designsystem.theme.AppTheme
import org.jetbrains.compose.resources.stringResource

/** Half-height modal sheet; constrained to the sheet max width so it stays tidy on tablets and in landscape. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppBottomSheet(
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val colors = AppTheme.colors
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        modifier = modifier,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        sheetMaxWidth = AppTheme.sizes.sheetMaxWidth,
        shape = AppTheme.shapes.sheet,
        containerColor = colors.card,
        scrimColor = colors.scrim,
        dragHandle = {
            Box(
                Modifier
                    .padding(vertical = AppTheme.spacing.space12)
                    .width(AppTheme.sizes.dragHandleWidth)
                    .height(AppTheme.sizes.dragHandleHeight)
                    .background(colors.line, AppTheme.shapes.pill),
            )
        },
    ) {
        content()
    }
}

/** Header of a full-screen sheet: close at Start, centered title, optional action at End. */
@Composable
fun AppSheetHeader(
    title: String,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
    action: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth().height(AppTheme.sizes.topBarHeight),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AppIconButton(AppIcons.Close, stringResource(Res.string.common_close), onClose)
        AppText(
            text = title,
            style = AppTheme.typography.titleMedium,
            textAlign = TextAlign.Center,
            maxLines = 1,
            modifier = Modifier.weight(1f),
        )
        Box(Modifier.width(AppTheme.sizes.touchTarget), contentAlignment = Alignment.Center) { action?.invoke() }
    }
}

/** Full-screen sheet (filters, add review...): a window-filling dialog with the screen background. */
@Composable
fun AppFullScreenSheet(
    title: String,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
    action: (@Composable () -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(dismissOnBackPress = true, dismissOnClickOutside = false, usePlatformDefaultWidth = false),
    ) {
        Column(modifier = modifier.fillMaxSize().background(AppTheme.colors.background)) {
            AppSheetHeader(title = title, onClose = onClose, action = action)
            content()
        }
    }
}
