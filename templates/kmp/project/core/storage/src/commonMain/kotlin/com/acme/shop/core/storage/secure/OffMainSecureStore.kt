package com.acme.shop.core.storage.secure

import com.acme.shop.core.security.SecureKeyValueStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.IO
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlin.coroutines.CoroutineContext

/**
 * Runs the platform secure store (Android Keystore cipher, iOS Keychain) on [ioContext] and keeps the plain values
 * in memory after the first read.
 *
 * Keystore/Keychain calls are synchronous IPC to a system service; callers such as the HTTP auth interceptor and the
 * sign-in use cases run on the main dispatcher, so every signed-in request decrypted the token on the UI thread.
 * This store is the only writer of its keys, so the cache cannot go stale.
 */
class OffMainSecureStore(
    private val delegate: SecureKeyValueStore,
    private val ioContext: CoroutineContext = Dispatchers.IO,
) : SecureKeyValueStore {

    private val mutex = Mutex()
    private val cache = mutableMapOf<String, String?>()

    override suspend fun read(key: String): String? = mutex.withLock {
        if (cache.containsKey(key)) {
            cache[key]
        } else {
            withContext(ioContext) { delegate.read(key) }.also { cache[key] = it }
        }
    }

    override suspend fun write(key: String, value: String?) = mutex.withLock {
        withContext(ioContext) { delegate.write(key, value) }
        cache[key] = value
    }
}
