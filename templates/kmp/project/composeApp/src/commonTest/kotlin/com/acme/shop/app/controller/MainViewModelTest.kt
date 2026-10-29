package com.acme.shop.app.controller

import com.acme.shop.app.analytics.SessionAnalyticsSync
import com.acme.shop.app.controller.contract.MainContract.UiAction
import com.acme.shop.app.controller.vm.MainViewModel
import com.acme.shop.core.analytics.NoOpAnalyticsTracker
import com.acme.shop.core.common.AppEnvironment
import com.acme.shop.core.domain.AppLanguage
import com.acme.shop.core.domain.AppSettings
import com.acme.shop.core.domain.AppearanceSettings
import com.acme.shop.core.domain.ThemeMode
import com.acme.shop.core.domain.repository.SessionTimeOut
import com.acme.shop.core.domain.session.SessionState
import com.acme.shop.core.firebase.FakeCrashReporter
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals

private class FakeSessionTimeOut : SessionTimeOut {
    override val sessionEventTimeOut: Channel<Boolean> = Channel(Channel.BUFFERED)
    val sent = mutableListOf<Boolean>()
    override suspend fun sendSessionTimeOut(isTimeOut: Boolean) {
        sent += isTimeOut
    }
}

private class MinimalAppSettings : AppSettings {
    var sessionCleared = 0
    private val text = MutableStateFlow<String?>(null)
    override val language: Flow<String> = MutableStateFlow(AppLanguage.DEFAULT.code)
    override val themeMode: Flow<ThemeMode> = MutableStateFlow(ThemeMode.DARK)
    override val token: Flow<String?> = text
    override val fcmToken: Flow<String?> = text
    override val refreshToken: Flow<String?> = text
    override val userId: Flow<String?> = text
    override val userRole: Flow<String?> = text
    override val userName: Flow<String?> = text
    override val onboardingCompleted: Flow<Boolean> = MutableStateFlow(false)
    override val lastSyncTimestamp: Flow<Long?> = MutableStateFlow(null)
    override val deviceId: Flow<String?> = text
    override suspend fun setLanguage(language: String) = Unit
    override suspend fun setThemeMode(mode: ThemeMode) = Unit
    override suspend fun setToken(token: String?) = Unit
    override suspend fun setFcmToken(fcmToken: String?) = Unit
    override suspend fun setRefreshToken(token: String?) = Unit
    override suspend fun setUserId(id: String?) = Unit
    override suspend fun setUserRole(role: String?) = Unit
    override suspend fun setUserName(name: String?) = Unit
    override suspend fun setOnboardingCompleted(completed: Boolean) = Unit
    override suspend fun setLastSyncTimestamp(timestamp: Long) = Unit
    override suspend fun setDeviceId(id: String?) = Unit
    override suspend fun clearAll() = Unit
    override suspend fun clearSession() {
        sessionCleared += 1
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class MainViewModelTest {

    private val environment = AppEnvironment("dev", "https://api.example", "https://web.example", "1.2.3", 7, isDebug = true)
    private val settings = MinimalAppSettings()
    private val sessionTimeOut = FakeSessionTimeOut()

    private fun TestScope.viewModel() = MainViewModel(
        appSettings = settings,
        appearanceSettings = AppearanceSettings(settings),
        sessionTimeOut = sessionTimeOut,
        environment = environment,
        sessionAnalyticsSync = SessionAnalyticsSync(MutableStateFlow(SessionState.Guest), NoOpAnalyticsTracker, FakeCrashReporter()),
        testScope = backgroundScope,
    )

    @Test
    fun stateCarriesTheAppVersion() = runTest(UnconfinedTestDispatcher()) {
        assertEquals("1.2.3", viewModel().state.first().appVersion)
    }

    @Test
    fun sessionTimeOutClearsTheSessionAndResetsTheSignal() = runTest(UnconfinedTestDispatcher()) {
        val viewModel = viewModel()
        viewModel.onEvent(UiAction.OnSessionTimeOut)
        assertEquals(1, settings.sessionCleared)
        assertEquals(listOf(false), sessionTimeOut.sent)
    }
}
