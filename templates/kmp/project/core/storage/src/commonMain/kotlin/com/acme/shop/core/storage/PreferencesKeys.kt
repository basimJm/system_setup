package com.acme.shop.core.storage

import androidx.datastore.preferences.core.Preferences.Key
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey

object PreferencesKeys {
    val LANGUAGE: Key<String> = stringPreferencesKey("language")
    val THEME_MODE: Key<String> = stringPreferencesKey("theme_mode")

    val FCM_TOKEN: Key<String> = stringPreferencesKey("fcm_token")

    val USER_ID: Key<String> = stringPreferencesKey("user_id")
    val USER_ROLE: Key<String> = stringPreferencesKey("user_role")
    val USER_NAME: Key<String> = stringPreferencesKey("user_name")

    val ONBOARDING_COMPLETED: Key<Boolean> = booleanPreferencesKey("onboarding_completed")

    val LAST_SYNC_TIMESTAMP: Key<Long> = longPreferencesKey("last_sync_timestamp")
    val DEVICE_ID: Key<String> = stringPreferencesKey("device_id")
}
