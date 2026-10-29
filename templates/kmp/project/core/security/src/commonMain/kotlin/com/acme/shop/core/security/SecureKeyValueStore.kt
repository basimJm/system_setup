package com.acme.shop.core.security

/**
 * Small secrets (auth tokens) in platform-protected storage: Android Keystore-encrypted preferences, iOS Keychain.
 * Values are read on demand; implementations never log them.
 */
interface SecureKeyValueStore {
    suspend fun read(key: String): String?

    /** `null` removes the entry. */
    suspend fun write(key: String, value: String?)
}

/** Reversible string cipher behind the encrypted-preferences store; the Android actual wraps the Keystore. */
interface StringCipher {
    fun encrypt(plain: String): String

    /** `null` when the payload cannot be decrypted (corrupt or the key was invalidated): the entry is treated as absent. */
    fun decrypt(payload: String): String?
}

/** Plain in-memory store for tests and previews. */
class InMemorySecureKeyValueStore : SecureKeyValueStore {
    private val values = mutableMapOf<String, String>()

    override suspend fun read(key: String): String? = values[key]

    override suspend fun write(key: String, value: String?) {
        if (value == null) values.remove(key) else values[key] = value
    }
}
