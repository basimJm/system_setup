package com.acme.shop.core.notification.model

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import org.jetbrains.compose.resources.StringResource
import org.jetbrains.compose.resources.stringResource

sealed class NotificationContent {
    data class Message(val text: String) : NotificationContent()

    data class TitleAndMessage(
        val title: String,
        val message: String,
    ) : NotificationContent()

    data class CustomComposable(
        val messageRes: StringResource,
    ) : NotificationContent() {
        @Composable
        fun Display() {
            Text(text = stringResource(messageRes))
        }
    }
}

data class NotificationConfiguration(
    val content: NotificationContent,
    val style: NotificationStyle,
    val bodyTextStyle: TextStyle? = null,
    val titleTextStyle: TextStyle? = null,
    val customContentColor: Color? = null,
    val customBackgroundColor: Color? = null,
    val customCornerRadius: Dp? = null,
    val showDismissButton: Boolean = true,
    val autoDismissDelayMs: Long = 5000L,
)
