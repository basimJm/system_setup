package com.acme.shop.core.notification.composable

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.EaseInOut
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.acme.shop.core.notification.model.NotificationContent
import com.acme.shop.core.notification.state.NotificationEvent
import com.acme.shop.core.notification.state.NotificationHidden
import com.acme.shop.core.notification.state.NotificationItemState
import com.acme.shop.core.notification.state.NotificationRemoved
import com.acme.shop.core.notification.state.NotificationShown
import com.acme.shop.core.notification.state.NotificationViewModel
import kotlinx.coroutines.delay

@Composable
internal fun NotificationDisplay(
    viewModel: NotificationViewModel,
    bodyTextStyle: TextStyle,
) {
    val uiState by viewModel.uiState.collectAsState()

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .wrapContentHeight()
            .animateContentSize(),
        userScrollEnabled = false,
    ) {
        items(
            items = uiState.getOrderedNotifications(),
            key = { it.id },
        ) { notificationState ->
            NotificationItemWrapper(
                notificationState = notificationState,
                defaultBodyTextStyle = bodyTextStyle,
                onEvent = viewModel::handleEvent,
            )
        }
    }
}

@Composable
private fun NotificationItemWrapper(
    notificationState: NotificationItemState,
    defaultBodyTextStyle: TextStyle,
    onEvent: (NotificationEvent) -> Unit,
) {
    LaunchedEffect(Unit) {
        onEvent(NotificationShown(notificationState.id))
    }

    LaunchedEffect(notificationState.isVisible) {
        if (notificationState.isVisible) {
            delay(notificationState.autoDismissDelayMs)
            onEvent(NotificationHidden(notificationState.id))
        }
    }

    AnimatedVisibility(
        visible = notificationState.isVisible,
        enter = slideInVertically(
            animationSpec = spring(
                dampingRatio = Spring.DampingRatioNoBouncy,
                stiffness = Spring.StiffnessLow,
            ),
        ) { -it },
        exit = scaleOut(animationSpec = tween(easing = EaseInOut))
                + fadeOut(animationSpec = tween(easing = EaseInOut)),
    ) {
        NotificationCard(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            notificationState = notificationState,
            defaultBodyTextStyle = defaultBodyTextStyle,
            onEvent = onEvent,
        ) {
            onEvent(NotificationHidden(notificationState.id))
        }
    }
}

@Composable
private fun NotificationCard(
    modifier: Modifier = Modifier,
    notificationState: NotificationItemState,
    defaultBodyTextStyle: TextStyle,
    onEvent: (NotificationEvent) -> Unit,
    onDismiss: () -> Unit,
) {
    DisposableEffect(Unit) {
        onDispose { onEvent(NotificationRemoved(notificationState.id)) }
    }

    val backgroundColor = notificationState.customBackgroundColor
        ?: notificationState.style.backgroundColor
    val contentColor = notificationState.customContentColor
        ?: notificationState.style.contentColor
    val cardShape = if (notificationState.customCornerRadius != null) {
        RoundedCornerShape(notificationState.customCornerRadius)
    } else {
        notificationState.style.shape
    }

    Box(
        modifier = modifier.fillMaxWidth(),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .widthIn(max = 600.dp)
                .background(color = backgroundColor, shape = cardShape),
            contentAlignment = Alignment.Center,
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                NotificationContentDisplay(
                    modifier = Modifier
                        .weight(1f)
                        .padding(
                            start = 8.dp,
                            end = if (notificationState.showDismissButton) 32.dp else 8.dp,
                        ),
                    content = notificationState.content,
                    bodyTextStyle = notificationState.bodyTextStyle ?: defaultBodyTextStyle,
                    titleTextStyle = notificationState.titleTextStyle
                        ?: defaultBodyTextStyle.copy(fontWeight = FontWeight.SemiBold),
                    contentColor = contentColor,
                )

                if (notificationState.showDismissButton) {
                    IconButton(onClick = onDismiss) {
                        Text(
                            text = "\u2715",
                            color = contentColor,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun NotificationContentDisplay(
    modifier: Modifier = Modifier,
    content: NotificationContent,
    bodyTextStyle: TextStyle,
    titleTextStyle: TextStyle,
    contentColor: Color,
) {
    when (content) {
        is NotificationContent.Message -> {
            Text(
                modifier = modifier,
                text = content.text.trim(),
                style = bodyTextStyle.copy(color = contentColor),
                maxLines = 3,
            )
        }
        is NotificationContent.TitleAndMessage -> {
            Column(modifier = modifier) {
                Text(
                    text = content.title,
                    style = titleTextStyle.copy(color = contentColor),
                    maxLines = 1,
                )
                Text(
                    modifier = Modifier.padding(top = 4.dp),
                    text = content.message,
                    style = bodyTextStyle.copy(color = contentColor),
                    maxLines = 2,
                )
            }
        }
        is NotificationContent.CustomComposable -> {
            Box(modifier = modifier) { content.Display() }
        }
    }
}
