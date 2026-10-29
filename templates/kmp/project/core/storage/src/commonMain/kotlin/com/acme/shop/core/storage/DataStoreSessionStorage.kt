package com.acme.shop.core.storage

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

class DataStoreSessionStorage(
    private val dataStore: DataStore<Preferences>
) : SessionStorage {

    private val roleKey = stringPreferencesKey("user_role")
    private val userIdKey = stringPreferencesKey("user_id")

    override suspend fun getRole(): String? {
        return dataStore.data.map { preferences ->
            preferences[roleKey]
        }.first()
    }

    override suspend fun setRole(role: String?) {
        dataStore.edit { preferences ->
            if (role != null) {
                preferences[roleKey] = role
            } else {
                preferences.remove(roleKey)
            }
        }
    }

    override suspend fun getUserId(): String? {
        return dataStore.data.map { preferences ->
            preferences[userIdKey]
        }.first()
    }

    override suspend fun setUserId(userId: String?) {
        dataStore.edit { preferences ->
            if (userId != null) {
                preferences[userIdKey] = userId
            } else {
                preferences.remove(userIdKey)
            }
        }
    }
}
