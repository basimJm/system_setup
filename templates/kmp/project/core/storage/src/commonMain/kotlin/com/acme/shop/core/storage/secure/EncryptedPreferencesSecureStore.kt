package com.acme.shop.core.storage.secure

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.acme.shop.core.security.SecureKeyValueStore
import com.acme.shop.core.security.StringCipher
import kotlinx.coroutines.flow.first

private const val KEY_PREFIX = "secure_"

/** Secure store over DataStore: every value is encrypted by [cipher] (Android: Keystore) before it touches the disk. */
class EncryptedPreferencesSecureStore(
    private val dataStore: DataStore<Preferences>,
    private val cipher: StringCipher,
) : SecureKeyValueStore {

    override suspend fun read(key: String): String? =
        dataStore.data.first()[preferenceKey(key)]?.let(cipher::decrypt)

    override suspend fun write(key: String, value: String?) {
        val encrypted = value?.let(cipher::encrypt)
        dataStore.edit { prefs ->
            if (encrypted == null) prefs.remove(preferenceKey(key)) else prefs[preferenceKey(key)] = encrypted
        }
    }

    private fun preferenceKey(key: String): Preferences.Key<String> = stringPreferencesKey(KEY_PREFIX + key)
}
