package com.acme.shop.core.network.auth

import com.acme.shop.core.domain.AppSettings
import com.acme.shop.core.domain.ThemeMode
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow

/** In-memory settings: only the token members matter to the refresh tests, the rest just hold values. */
class FakeAppSettings(
    accessToken: String? = null,
    refreshToken: String? = null,
) : AppSettings {
    private val tokenState = MutableStateFlow(accessToken)
    private val refreshState = MutableStateFlow(refreshToken)
    private val languageState = MutableStateFlow("ar")
    private val themeState = MutableStateFlow(ThemeMode.SYSTEM)
    private val textState = MutableStateFlow<String?>(null)

    override val language: Flow<String> = languageState
    override val themeMode: Flow<ThemeMode> = themeState
    override val token: Flow<String?> = tokenState
    override val fcmToken: Flow<String?> = textState
    override val refreshToken: Flow<String?> = refreshState
    override val userId: Flow<String?> = textState
    override val userRole: Flow<String?> = textState
    override val userName: Flow<String?> = textState
    override val onboardingCompleted: Flow<Boolean> = MutableStateFlow(false)
    override val lastSyncTimestamp: Flow<Long?> = MutableStateFlow(null)
    override val deviceId: Flow<String?> = textState

    override suspend fun setLanguage(language: String) {
        languageState.value = language
    }

    override suspend fun setThemeMode(mode: ThemeMode) {
        themeState.value = mode
    }

    override suspend fun setToken(token: String?) {
        tokenState.value = token
    }

    override suspend fun setFcmToken(fcmToken: String?) = Unit

    override suspend fun setRefreshToken(token: String?) {
        refreshState.value = token
    }

    override suspend fun setUserId(id: String?) = Unit
    override suspend fun setUserRole(role: String?) = Unit
    override suspend fun setUserName(name: String?) = Unit
    override suspend fun setOnboardingCompleted(completed: Boolean) = Unit
    override suspend fun setLastSyncTimestamp(timestamp: Long) = Unit
    override suspend fun setDeviceId(id: String?) = Unit

    override suspend fun clearAll() {
        tokenState.value = null
        refreshState.value = null
    }

    override suspend fun clearSession() = clearAll()
}
