package com.acme.shop.core.data.mock

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** What the fixture transport answers: every state a screen must handle, switchable at runtime. */
enum class MockScenario {
    Success,
    Empty,
    Unauthorized,
    NotFound,
    ServerError,
    Timeout,
    Offline,
}

/** Current scenario of the mock transport; dev builds switch it from the profile screen. */
object MockScenarios {
    private val state = MutableStateFlow(MockScenario.Success)
    val current: StateFlow<MockScenario> = state.asStateFlow()

    fun set(scenario: MockScenario) {
        state.value = scenario
    }
}
