package com.acme.shop.core.mvi

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

private data class LoadState(val loading: Boolean = false, val items: List<String> = emptyList())

private sealed interface LoadAction {
    data object Refresh : LoadAction
}

private sealed interface LoadEffect {
    data object Done : LoadEffect
}

private class LoadViewModel(scope: CoroutineScope) : BaseViewModel<LoadState, LoadAction, LoadEffect>(LoadState(), scope) {
    var started = 0
        private set

    override fun onStart() {
        started += 1
        load()
    }

    override fun handle(event: LoadAction) {
        when (event) {
            LoadAction.Refresh -> load()
        }
    }

    private fun load() {
        scope.launch {
            updateState { copy(loading = true) }
            updateState { copy(loading = false, items = listOf("item")) }
            emitSideEffect(LoadEffect.Done)
        }
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class BaseViewModelTest {

    @Test
    fun onStartRunsWhenStateIsFirstCollected() = runTest {
        val viewModel = LoadViewModel(TestScope(StandardTestDispatcher(testScheduler)))
        assertEquals(0, viewModel.started)
        val job = launch { viewModel.state.collect { } }
        advanceUntilIdle()
        assertEquals(1, viewModel.started)
        assertEquals(listOf("item"), viewModel.uiState.value.items)
        assertFalse(viewModel.uiState.value.loading)
        job.cancel()
    }

    @Test
    fun eventsReachOnEventAndUpdateState() = runTest(UnconfinedTestDispatcher()) {
        val viewModel = LoadViewModel(backgroundScope)
        viewModel.onEvent(LoadAction.Refresh)
        assertEquals(listOf("item"), viewModel.uiState.first().items)
    }

    @Test
    fun emitSideEffectUsesTheViewModelScope() = runTest(UnconfinedTestDispatcher()) {
        val viewModel = LoadViewModel(backgroundScope)
        var done = false
        val job = launch { viewModel.sideEffect.collect { done = it == LoadEffect.Done } }
        viewModel.onEvent(LoadAction.Refresh)
        job.cancel()
        assertTrue(done)
    }
}
