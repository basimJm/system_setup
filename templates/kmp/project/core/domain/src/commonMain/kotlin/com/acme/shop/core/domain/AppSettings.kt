package com.acme.shop.core.domain

import kotlinx.coroutines.flow.Flow

interface AppSettings {
    val language: Flow<String>
    val themeMode: Flow<ThemeMode>
    val token: Flow<String?>
    val fcmToken: Flow<String?>
    val refreshToken: Flow<String?>
    val userId: Flow<String?>
    val userRole: Flow<String?>
    val userName: Flow<String?>
    val onboardingCompleted: Flow<Boolean>
    val lastSyncTimestamp: Flow<Long?>
    val deviceId: Flow<String?>

    suspend fun setLanguage(language: String)
    suspend fun setThemeMode(mode: ThemeMode)
    suspend fun setToken(token: String?)
    suspend fun setFcmToken(fcmToken: String?)
    suspend fun setRefreshToken(token: String?)
    suspend fun setUserId(id: String?)
    suspend fun setUserRole(role: String?)
    suspend fun setUserName(name: String?)
    suspend fun setOnboardingCompleted(completed: Boolean)
    suspend fun setLastSyncTimestamp(timestamp: Long)
    suspend fun setDeviceId(id: String?)

    suspend fun clearAll()
    suspend fun clearSession()
}
