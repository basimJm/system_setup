package com.acme.shop.core.storage

import com.acme.shop.core.domain.auth.AuthTokens
import com.acme.shop.core.domain.session.SessionState
import com.acme.shop.core.domain.session.UserProfile
import com.acme.shop.core.security.InMemorySecureKeyValueStore
import com.acme.shop.core.storage.session.DataStoreSessionStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class DataStoreSessionStoreTest {

    private val dataStore = InMemoryPreferencesDataStore()
    private val secure = InMemorySecureKeyValueStore()
    private val store = DataStoreSessionStore(dataStore, secure)
    private val tokens = AuthTokens(accessToken = "access-1", refreshToken = "refresh-1")
    private val user = UserProfile(id = "u1", firstName = "Sam")

    @Test
    fun freshInstallIsAGuestWithDefaults() = runTest {
        assertEquals(SessionState.Guest, store.state.first())
        assertFalse(store.onboardingSeen.first())
        assertTrue(store.pushEnabled.first())
        assertNull(store.tokens())
    }

    @Test
    fun signInStoresTokensSecurelyAndSignOutKeepsLocalPreferences() = runTest {
        store.setOnboardingSeen(true)
        store.setPushEnabled(false)
        store.signIn(tokens, user)
        assertEquals(SessionState.SignedIn(user), store.state.first())
        assertEquals(tokens, store.tokens())
        assertEquals("access-1", secure.read("access_token"))
        assertNull(dataStore.data.first().asMap().entries.firstOrNull { it.value == "access-1" })

        store.updateTokens(AuthTokens("access-2", "refresh-2"))
        assertEquals("access-2", store.tokens()?.accessToken)
        assertTrue(store.state.first().isSignedIn)

        store.signOut()
        assertNull(store.tokens())
        assertEquals(SessionState.Guest, store.state.first())
        assertTrue(store.onboardingSeen.first())
        assertFalse(store.pushEnabled.first())
    }

    @Test
    fun updateUserKeepsTheSession() = runTest {
        store.signIn(tokens, user)
        store.updateUser(user.copy(firstName = "Alex"))
        assertEquals(SessionState.SignedIn(UserProfile("u1", "Alex")), store.state.first())
    }

    @Test
    fun halfWrittenTokensCountAsSignedOut() = runTest {
        secure.write("access_token", "orphan")
        assertNull(store.tokens())
    }

    @Test
    fun clearAllForgetsEverything() = runTest {
        store.setOnboardingSeen(true)
        store.signIn(tokens, user)
        store.clearAll()
        assertEquals(SessionState.Guest, store.state.first())
        assertFalse(store.onboardingSeen.first())
        assertNull(store.tokens())
        assertTrue(dataStore.data.first().asMap().isEmpty())
    }
}
