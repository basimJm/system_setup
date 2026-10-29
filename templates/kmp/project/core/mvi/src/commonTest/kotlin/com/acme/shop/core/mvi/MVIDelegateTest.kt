package com.acme.shop.core.mvi

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals

private data class CounterState(val count: Int = 0, val label: String = "")

private sealed interface CounterAction {
    data object Increment : CounterAction
}

private sealed interface CounterEffect {
    data class Toast(val text: String) : CounterEffect
}

/** Calls the member-extension `CoroutineScope.emitSideEffect` with an explicit scope. */
private fun <S, A, E> MVI<S, A, E>.emitFrom(scope: CoroutineScope, effect: E) {
    with(scope) { emitSideEffect(effect) }
}

@OptIn(ExperimentalCoroutinesApi::class)
class MVIDelegateTest {

    private fun delegate(): MVI<CounterState, CounterAction, CounterEffect> = mvi(CounterState())

    @Test
    fun initialStateIsExposed() = runTest {
        val mvi = delegate()
        assertEquals(CounterState(), mvi.uiState.value)
    }

    @Test
    fun updateStateWithReducerAppliesCopy() = runTest {
        val mvi = delegate()
        mvi.updateState { copy(count = count + 1) }
        mvi.updateState { copy(label = "one") }
        assertEquals(CounterState(count = 1, label = "one"), mvi.uiState.value)
    }

    @Test
    fun updateStateWithValueReplacesWholeState() = runTest {
        val mvi = delegate()
        mvi.updateState { copy(count = 5) }
        mvi.updateState(CounterState(label = "reset"))
        assertEquals(CounterState(count = 0, label = "reset"), mvi.uiState.value)
    }

    @Test
    fun sideEffectsAreDeliveredInOrder() = runTest(UnconfinedTestDispatcher()) {
        val mvi = delegate()
        val received = mutableListOf<CounterEffect>()
        val collector = launch { mvi.sideEffect.collect { received += it } }
        mvi.emitFrom(this, CounterEffect.Toast("a"))
        mvi.emitFrom(this, CounterEffect.Toast("b"))
        collector.cancel()
        assertEquals(listOf<CounterEffect>(CounterEffect.Toast("a"), CounterEffect.Toast("b")), received)
    }

    @Test
    fun defaultOnEventIsANoOp() = runTest {
        val mvi = delegate()
        mvi.onEvent(CounterAction.Increment)
        assertEquals(CounterState(), mvi.uiState.first())
    }

    @Test
    fun sideEffectIsConsumedOnce() = runTest(UnconfinedTestDispatcher()) {
        val mvi = delegate()
        val first = mutableListOf<CounterEffect>()
        val job = launch { mvi.sideEffect.collect { first += it } }
        mvi.emitFrom(this, CounterEffect.Toast("once"))
        job.cancel()
        val second = launch { mvi.sideEffect.toList(mutableListOf()) }
        second.cancel()
        assertEquals(listOf<CounterEffect>(CounterEffect.Toast("once")), first)
    }
}
