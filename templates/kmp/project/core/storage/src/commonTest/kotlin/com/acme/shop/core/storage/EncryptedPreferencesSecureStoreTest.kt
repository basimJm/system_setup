package com.acme.shop.core.storage

import androidx.datastore.preferences.core.stringPreferencesKey
import com.acme.shop.core.security.StringCipher
import com.acme.shop.core.storage.secure.EncryptedPreferencesSecureStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

private const val ENCRYPTED_PREFIX = "enc:"

/** Reversible stand-in: proves the store never writes plain text and tolerates undecryptable entries. */
private class ReversingCipher : StringCipher {
    override fun encrypt(plain: String): String = ENCRYPTED_PREFIX + plain.reversed()
    override fun decrypt(payload: String): String? =
        payload.takeIf { it.startsWith(ENCRYPTED_PREFIX) }?.removePrefix(ENCRYPTED_PREFIX)?.reversed()
}

class EncryptedPreferencesSecureStoreTest {

    private val dataStore = InMemoryPreferencesDataStore()
    private val store = EncryptedPreferencesSecureStore(dataStore, ReversingCipher())

    @Test
    fun valuesAreEncryptedAtRestAndDecryptedOnRead() = runTest {
        store.write("k", "secret-value")
        assertEquals("secret-value", store.read("k"))
        assertEquals(ENCRYPTED_PREFIX + "secret-value".reversed(), dataStore.data.first()[stringPreferencesKey("secure_k")])
        store.write("k", null)
        assertNull(store.read("k"))
        assertNull(dataStore.data.first()[stringPreferencesKey("secure_k")])
    }

    @Test
    fun undecryptableEntriesReadAsAbsent() = runTest {
        dataStore.updateData { prefs -> prefs.toMutablePreferences().apply { this[stringPreferencesKey("secure_k")] = "plain" } }
        assertNull(store.read("k"))
    }
}
