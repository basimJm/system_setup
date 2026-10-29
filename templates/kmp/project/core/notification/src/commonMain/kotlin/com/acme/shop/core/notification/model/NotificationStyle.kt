package com.acme.shop.core.notification.model

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.dp

sealed class NotificationStyle {
    @get:Composable
    abstract val backgroundColor: Color

    @get:Composable
    abstract val contentColor: Color

    @get:Composable
    open val shape: Shape get() = RoundedCornerShape(12.dp)

    data object Error : NotificationStyle() {
        override val backgroundColor: Color
            @Composable get() = MaterialTheme.colorScheme.error

        override val contentColor: Color
            @Composable get() = MaterialTheme.colorScheme.onError
    }

    data object Success : NotificationStyle() {
        override val backgroundColor: Color
            @Composable get() = Color(0xFF4EDEA3)

        override val contentColor: Color
            @Composable get() = Color(0xFFDDE4DD)
    }

    data object Warning : NotificationStyle() {
        override val backgroundColor: Color
            @Composable get() = Color(0xFFFFC107)

        override val contentColor: Color
            @Composable get() = Color(0xFFDDE4DD)
    }

    data object Info : NotificationStyle() {
        override val backgroundColor: Color
            @Composable get() = MaterialTheme.colorScheme.primary

        override val contentColor: Color
            @Composable get() = MaterialTheme.colorScheme.onPrimary
    }
}
