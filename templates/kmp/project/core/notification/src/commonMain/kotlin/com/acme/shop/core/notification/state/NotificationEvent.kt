package com.acme.shop.core.notification.state

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import com.acme.shop.core.notification.model.NotificationContent
import com.acme.shop.core.notification.model.NotificationStyle

sealed interface NotificationEvent

data class ShowNotification(
    val id: String,
    val content: NotificationContent,
    val style: NotificationStyle,
    val bodyTextStyle: TextStyle? = null,
    val titleTextStyle: TextStyle? = null,
    val customContentColor: Color? = null,
    val customBackgroundColor: Color? = null,
    val customCornerRadius: Dp? = null,
    val showDismissButton: Boolean = true,
    val autoDismissDelayMs: Long = 5000L,
) : NotificationEvent

data class NotificationShown(val id: String) : NotificationEvent
data class NotificationHidden(val id: String) : NotificationEvent
data class NotificationRemoved(val id: String) : NotificationEvent
