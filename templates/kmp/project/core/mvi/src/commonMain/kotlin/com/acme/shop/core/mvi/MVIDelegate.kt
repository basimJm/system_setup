package com.acme.shop.core.mvi

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.coroutines.CoroutineContext
import kotlin.coroutines.EmptyCoroutineContext

class MVIDelegate<UiState, UiEvent, SideEffect> internal constructor(
    initialUiState: UiState,
) : MVI<UiState, UiEvent, SideEffect> {

    private val _uiState = MutableStateFlow(initialUiState)
    override val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    private val _sideEffect by lazy { Channel<SideEffect>() }
    override val sideEffect: Flow<SideEffect> by lazy { _sideEffect.receiveAsFlow() }

    override fun onEvent(event: UiEvent) {}

    override fun updateState(state: UiState.() -> UiState) {
        _uiState.update(state)
    }

    override fun updateState(state: UiState) {
        _uiState.update { state }
    }

    override fun CoroutineScope.emitSideEffect(effect: SideEffect) {
        this.launch { _sideEffect.send(effect) }
    }
}

fun <UiState, UiEvent, SideEffect> mvi(
    initialUiState: UiState
): MVI<UiState, UiEvent, SideEffect> = MVIDelegate(initialUiState)

@Composable
fun <SideEffect> CollectSideEffect(
    sideEffect: Flow<SideEffect>,
    lifecycleOwner: LifecycleOwner = LocalLifecycleOwner.current,
    minActiveState: Lifecycle.State = Lifecycle.State.STARTED,
    context: CoroutineContext = Dispatchers.Main.immediate,
    onSideEffect: suspend CoroutineScope.(effect: SideEffect) -> Unit,
) {
    LaunchedEffect(sideEffect, lifecycleOwner) {
        lifecycleOwner.lifecycle.repeatOnLifecycle(minActiveState) {
            if (context == EmptyCoroutineContext) {
                sideEffect.collect { onSideEffect(it) }
            } else {
                withContext(context) {
                    sideEffect.collect { onSideEffect(it) }
                }
            }
        }
    }
}
