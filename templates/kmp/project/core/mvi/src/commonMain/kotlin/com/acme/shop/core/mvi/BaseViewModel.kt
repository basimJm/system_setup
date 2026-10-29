package com.acme.shop.core.mvi

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.stateIn

/** How long the state keeps flowing after the last collector leaves (configuration changes, back navigation). */
private const val STATE_SUBSCRIPTION_TIMEOUT_MS = 5_000L

abstract class BaseViewModel<UiState, UiEvent, SideEffect>(
    initialState: UiState,
    private val testScope: CoroutineScope? = null,
) : ViewModel(), MVI<UiState, UiEvent, SideEffect> by mvi(initialState) {

    protected val scope: CoroutineScope get() = testScope ?: viewModelScope

    val state: StateFlow<UiState> = uiState
        .onStart {
            onStart()
        }
        .stateIn(
            scope = scope,
            started = SharingStarted.WhileSubscribed(STATE_SUBSCRIPTION_TIMEOUT_MS),
            initialValue = initialState,
        )

    fun emitSideEffect(effect: SideEffect) {
        scope.emitSideEffect(effect)
    }

    /** Every action passes the [UiActionObserver] tap before the view model handles it. */
    final override fun onEvent(event: UiEvent) {
        UiActionObserver.notify(this::class.simpleName.orEmpty(), event)
        handle(event)
    }

    /** The view model's reducer entry point (what `onEvent` used to be). */
    abstract fun handle(event: UiEvent)

    open fun onStart() {}
}
