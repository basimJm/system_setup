package com.acme.shop.core.storage

import com.acme.shop.core.security.SecureKeyValueStore
import com.acme.shop.core.storage.secure.OffMainSecureStore
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.runTest
import kotlin.coroutines.ContinuationInterceptor
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Records the dispatcher of every platform call and how often the platform store is hit. */
private class RecordingSecureStore : SecureKeyValueStore {
    val values = mutableMapOf<String, String>()
    val dispatchers = mutableListOf<CoroutineDispatcher?>()
    var reads = 0

    override suspend fun read(key: String): String? {
        reads++
        dispatchers += currentCoroutineContext()[ContinuationInterceptor] as? CoroutineDispatcher
        return values[key]
    }

    override suspend fun write(key: String, value: String?) {
        dispatchers += currentCoroutineContext()[ContinuationInterceptor] as? CoroutineDispatcher
        if (value == null) values.remove(key) else values[key] = value
    }
}

class OffMainSecureStoreTest {

    @Test
    fun platformCallsRunOnTheIoContext() = runTest {
        val io = StandardTestDispatcher(testScheduler)
        val platform = RecordingSecureStore()
        val store = OffMainSecureStore(platform, io)

        store.write("k", "v")
        store.read("other")

        assertEquals(2, platform.dispatchers.size)
        assertTrue(platform.dispatchers.all { it === io })
    }

    @Test
    fun readsAreCachedAfterTheFirstPlatformRead() = runTest {
        val platform = RecordingSecureStore().apply { values["k"] = "v" }
        val store = OffMainSecureStore(platform, StandardTestDispatcher(testScheduler))

        assertEquals("v", store.read("k"))
        assertEquals("v", store.read("k"))
        assertNull(store.read("missing"))
        assertNull(store.read("missing"))

        assertEquals(2, platform.reads)
    }

    @Test
    fun writesUpdateTheCacheAndThePlatformStore() = runTest {
        val platform = RecordingSecureStore()
        val store = OffMainSecureStore(platform, StandardTestDispatcher(testScheduler))

        store.write("k", "v1")
        assertEquals("v1", store.read("k"))
        store.write("k", null)

        assertNull(store.read("k"))
        assertNull(platform.values["k"])
        assertEquals(0, platform.reads)
    }
}
