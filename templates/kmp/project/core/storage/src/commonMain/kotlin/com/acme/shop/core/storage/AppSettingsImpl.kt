package com.acme.shop.core.storage

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import com.acme.shop.core.domain.AppLanguage
import com.acme.shop.core.domain.AppSettings
import com.acme.shop.core.domain.ThemeMode
import com.acme.shop.core.domain.session.SessionStore
import com.acme.shop.core.security.SecureKeyValueStore
import com.acme.shop.core.storage.session.SessionKeys
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map

/**
 * Template settings over DataStore. Tokens are delegated to the session store's secure entries so the
 * network layer (refresh interceptor) and the session store always see the same pair.
 */
class AppSettingsImpl(
    private val dataStore: DataStore<Preferences>,
    private val secure: SecureKeyValueStore,
    private val sessionStore: SessionStore,
) : AppSettings {

    override val language: Flow<String> = dataStore.data.map { preferences ->
        preferences[PreferencesKeys.LANGUAGE] ?: AppLanguage.DEFAULT.code
    }

    override val themeMode: Flow<ThemeMode> = dataStore.data.map { preferences ->
        val themeName = preferences[PreferencesKeys.THEME_MODE] ?: ThemeMode.SYSTEM.name
        ThemeMode.fromString(themeName)
    }

    override val token: Flow<String?> = flow { emit(secure.read(SessionKeys.SECURE_ACCESS)) }
    override val fcmToken: Flow<String?> = dataStore.data.map { preferences ->
        preferences[PreferencesKeys.FCM_TOKEN]
    }

    override val refreshToken: Flow<String?> = flow { emit(secure.read(SessionKeys.SECURE_REFRESH)) }

    override val userId: Flow<String?> = dataStore.data.map { preferences ->
        preferences[PreferencesKeys.USER_ID]
    }

    override val userRole: Flow<String?> = dataStore.data.map { preferences ->
        preferences[PreferencesKeys.USER_ROLE]
    }

    override val userName: Flow<String?> = dataStore.data.map { preferences ->
        preferences[PreferencesKeys.USER_NAME]
    }

    override val onboardingCompleted: Flow<Boolean> = dataStore.data.map { preferences ->
        preferences[PreferencesKeys.ONBOARDING_COMPLETED] ?: false
    }

    override val lastSyncTimestamp: Flow<Long?> = dataStore.data.map { preferences ->
        preferences[PreferencesKeys.LAST_SYNC_TIMESTAMP]
    }

    override val deviceId: Flow<String?> = dataStore.data.map { preferences ->
        preferences[PreferencesKeys.DEVICE_ID]
    }

    override suspend fun setLanguage(language: String) {
        dataStore.edit { preferences ->
            preferences[PreferencesKeys.LANGUAGE] = language
        }
    }

    override suspend fun setThemeMode(mode: ThemeMode) {
        dataStore.edit { preferences ->
            preferences[PreferencesKeys.THEME_MODE] = mode.name
        }
    }

    override suspend fun setToken(token: String?) = secure.write(SessionKeys.SECURE_ACCESS, token)

    override suspend fun setFcmToken(fcmToken: String?) {
        dataStore.edit { preferences ->
            if (fcmToken != null) {
                preferences[PreferencesKeys.FCM_TOKEN] = fcmToken
            } else {
                preferences.remove(PreferencesKeys.FCM_TOKEN)
            }
        }
    }

    override suspend fun setRefreshToken(token: String?) = secure.write(SessionKeys.SECURE_REFRESH, token)

    override suspend fun setUserId(id: String?) {
        dataStore.edit { preferences ->
            if (id != null) {
                preferences[PreferencesKeys.USER_ID] = id
            } else {
                preferences.remove(PreferencesKeys.USER_ID)
            }
        }
    }

    override suspend fun setUserRole(role: String?) {
        dataStore.edit { preferences ->
            if (role != null) {
                preferences[PreferencesKeys.USER_ROLE] = role
            } else {
                preferences.remove(PreferencesKeys.USER_ROLE)
            }
        }
    }

    override suspend fun setUserName(name: String?) {
        dataStore.edit { preferences ->
            if (name != null) {
                preferences[PreferencesKeys.USER_NAME] = name
            } else {
                preferences.remove(PreferencesKeys.USER_NAME)
            }
        }
    }

    override suspend fun setOnboardingCompleted(completed: Boolean) {
        dataStore.edit { preferences ->
            preferences[PreferencesKeys.ONBOARDING_COMPLETED] = completed
        }
    }

    override suspend fun setLastSyncTimestamp(timestamp: Long) {
        dataStore.edit { preferences ->
            preferences[PreferencesKeys.LAST_SYNC_TIMESTAMP] = timestamp
        }
    }

    override suspend fun setDeviceId(id: String?) {
        dataStore.edit { preferences ->
            if (id != null) {
                preferences[PreferencesKeys.DEVICE_ID] = id
            } else {
                preferences.remove(PreferencesKeys.DEVICE_ID)
            }
        }
    }

    override suspend fun clearAll() {
        sessionStore.clearAll()
        dataStore.edit { preferences ->
            preferences.clear()
        }
    }

    override suspend fun clearSession() {
        sessionStore.signOut()
        dataStore.edit { preferences ->
            preferences.remove(PreferencesKeys.USER_ID)
            preferences.remove(PreferencesKeys.USER_ROLE)
        }
    }
}
