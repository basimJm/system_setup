package com.acme.shop.core.notification.state

import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class NotificationViewModel : ViewModel() {

    private val _uiState = MutableStateFlow(NotificationUiState())
    val uiState: StateFlow<NotificationUiState> = _uiState.asStateFlow()

    fun handleEvent(event: NotificationEvent) {
        when (event) {
            is ShowNotification -> {
                val counter = _uiState.value.notifications.size
                val uniqueId = "${event.id}_$counter"
                _uiState.value.notifications[uniqueId] = NotificationItemState(
                    id = uniqueId,
                    content = event.content,
                    style = event.style,
                    bodyTextStyle = event.bodyTextStyle,
                    titleTextStyle = event.titleTextStyle,
                    customContentColor = event.customContentColor,
                    customBackgroundColor = event.customBackgroundColor,
                    customCornerRadius = event.customCornerRadius,
                    showDismissButton = event.showDismissButton,
                    autoDismissDelayMs = event.autoDismissDelayMs,
                )
            }
            is NotificationShown -> {
                _uiState.value.notifications[event.id]?.let {
                    _uiState.value.notifications[it.id] = it.copy(isVisible = true)
                }
            }
            is NotificationHidden -> {
                _uiState.value.notifications[event.id]?.let {
                    _uiState.value.notifications[it.id] = it.copy(isVisible = false)
                }
            }
            is NotificationRemoved -> {
                _uiState.value.notifications.remove(event.id)
            }
        }
    }
}
