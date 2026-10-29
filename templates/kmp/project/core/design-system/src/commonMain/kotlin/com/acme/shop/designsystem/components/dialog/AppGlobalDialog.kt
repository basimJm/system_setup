package com.acme.shop.designsystem.components.dialog

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import com.acme.shop.designsystem.components.badge.StatusTone
import com.acme.shop.designsystem.icons.AppIcons
import com.acme.shop.designsystem.resources.Res
import com.acme.shop.designsystem.resources.dialog_auth_confirm
import com.acme.shop.designsystem.resources.dialog_auth_title
import com.acme.shop.designsystem.resources.dialog_camera_denied_title
import com.acme.shop.designsystem.resources.dialog_cancel
import com.acme.shop.designsystem.resources.dialog_delete_account_confirm
import com.acme.shop.designsystem.resources.dialog_delete_account_message
import com.acme.shop.designsystem.resources.dialog_delete_account_title
import com.acme.shop.designsystem.resources.dialog_location_confirm
import com.acme.shop.designsystem.resources.dialog_location_denied_confirm
import com.acme.shop.designsystem.resources.dialog_location_denied_title
import com.acme.shop.designsystem.resources.dialog_location_title
import com.acme.shop.designsystem.resources.dialog_logout_confirm
import com.acme.shop.designsystem.resources.dialog_logout_title
import com.acme.shop.designsystem.resources.dialog_notifications_denied_title
import com.acme.shop.designsystem.resources.dialog_session_expired_confirm
import com.acme.shop.designsystem.resources.dialog_session_expired_title
import com.acme.shop.designsystem.resources.dialog_update_confirm
import com.acme.shop.designsystem.resources.dialog_update_later
import com.acme.shop.designsystem.resources.dialog_update_title
import org.jetbrains.compose.resources.StringResource
import org.jetbrains.compose.resources.stringResource

/** The global dialogs of Design Script §1.3 plus the two account confirmations of . */
enum class GlobalDialogKind {
    AuthRequired,
    SessionExpired,
    OptionalUpdate,
    LocationExplanation,
    LocationDenied,
    CameraDenied,
    NotificationsDenied,
    Logout,
    DeleteAccount,
}

/** Visual contract of each kind, pure so it is unit-tested. */
data class GlobalDialogSpec(
    val icon: ImageVector,
    val tone: StatusTone,
    val hasDismissButton: Boolean,
    val dismissOnOutside: Boolean,
)

fun globalDialogSpec(kind: GlobalDialogKind): GlobalDialogSpec = when (kind) {
    GlobalDialogKind.AuthRequired -> GlobalDialogSpec(AppIcons.Profile, StatusTone.Accent, true, true)
    GlobalDialogKind.SessionExpired -> GlobalDialogSpec(AppIcons.Info, StatusTone.Warning, false, false)
    GlobalDialogKind.OptionalUpdate -> GlobalDialogSpec(AppIcons.Refresh, StatusTone.Accent, true, true)
    GlobalDialogKind.LocationExplanation -> GlobalDialogSpec(AppIcons.Search, StatusTone.Accent, true, true)
    GlobalDialogKind.LocationDenied,
    GlobalDialogKind.CameraDenied,
    GlobalDialogKind.NotificationsDenied -> GlobalDialogSpec(AppIcons.Info, StatusTone.Warning, true, true)
    GlobalDialogKind.Logout -> GlobalDialogSpec(AppIcons.Close, StatusTone.Neutral, true, true)
    GlobalDialogKind.DeleteAccount -> GlobalDialogSpec(AppIcons.Error, StatusTone.Danger, true, true)
}

private data class GlobalDialogTexts(
    val title: StringResource,
    val confirm: StringResource,
    val message: StringResource? = null,
    val dismiss: StringResource? = Res.string.dialog_cancel,
)

private fun textsOf(kind: GlobalDialogKind): GlobalDialogTexts = when (kind) {
    GlobalDialogKind.AuthRequired -> GlobalDialogTexts(Res.string.dialog_auth_title, Res.string.dialog_auth_confirm)
    GlobalDialogKind.SessionExpired ->
        GlobalDialogTexts(Res.string.dialog_session_expired_title, Res.string.dialog_session_expired_confirm, dismiss = null)
    GlobalDialogKind.OptionalUpdate ->
        GlobalDialogTexts(Res.string.dialog_update_title, Res.string.dialog_update_confirm, dismiss = Res.string.dialog_update_later)
    GlobalDialogKind.LocationExplanation -> GlobalDialogTexts(Res.string.dialog_location_title, Res.string.dialog_location_confirm)
    GlobalDialogKind.LocationDenied ->
        GlobalDialogTexts(Res.string.dialog_location_denied_title, Res.string.dialog_location_denied_confirm)
    GlobalDialogKind.CameraDenied ->
        GlobalDialogTexts(Res.string.dialog_camera_denied_title, Res.string.dialog_location_denied_confirm)
    GlobalDialogKind.NotificationsDenied ->
        GlobalDialogTexts(Res.string.dialog_notifications_denied_title, Res.string.dialog_location_denied_confirm)
    GlobalDialogKind.Logout -> GlobalDialogTexts(Res.string.dialog_logout_title, Res.string.dialog_logout_confirm)
    GlobalDialogKind.DeleteAccount -> GlobalDialogTexts(
        Res.string.dialog_delete_account_title,
        Res.string.dialog_delete_account_confirm,
        message = Res.string.dialog_delete_account_message,
    )
}

/**
 * One composable for every global dialog: the feature decides *when* it shows and what confirm / dismiss do;
 * texts, icon, tone and dismiss behaviour follow the design script, so every screen shows the same dialog.
 */
@Composable
fun AppGlobalDialog(
    kind: GlobalDialogKind,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val spec = globalDialogSpec(kind)
    val texts = textsOf(kind)
    AppDialog(
        title = stringResource(texts.title),
        confirmText = stringResource(texts.confirm),
        onConfirm = onConfirm,
        onDismiss = onDismiss,
        modifier = modifier,
        message = texts.message?.let { stringResource(it) },
        dismissText = if (spec.hasDismissButton) texts.dismiss?.let { stringResource(it) } else null,
        icon = spec.icon,
        tone = spec.tone,
        dismissOnOutside = spec.dismissOnOutside,
    )
}
