package com.acme.shop.core.storage.session

import androidx.datastore.preferences.core.Preferences.Key
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey

/** Session keys. Plain values live in DataStore; the two token keys name entries of the secure store. */
object SessionKeys {
    val ONBOARDING_SEEN: Key<Boolean> = booleanPreferencesKey("onboarding_seen")
    val USER_ID: Key<String> = stringPreferencesKey("user_id")
    val USER_FIRST_NAME: Key<String> = stringPreferencesKey("user_first_name")
    val PUSH_ENABLED: Key<Boolean> = booleanPreferencesKey("push_enabled")

    /** Non-secret marker that a token pair exists, so the session state can be a flow without reading the secure store. */
    val SIGNED_IN: Key<Boolean> = booleanPreferencesKey("signed_in")

    /** Entry names in the secure store (not DataStore keys). */
    const val SECURE_ACCESS = "access_token"
    const val SECURE_REFRESH = "refresh_token"

    /** Push is on by default; the OS permission still gates delivery. */
    const val PUSH_ENABLED_DEFAULT = true
}
