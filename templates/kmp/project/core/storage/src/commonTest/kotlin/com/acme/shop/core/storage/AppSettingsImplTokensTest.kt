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
import kotlin.test.assertNull

class AppSettingsImplTokensTest {

    private val dataStore = InMemoryPreferencesDataStore()
    private val secure = InMemorySecureKeyValueStore()
    private val sessionStore = DataStoreSessionStore(dataStore, secure)
    private val settings = AppSettingsImpl(dataStore, secure, sessionStore)

    @Test
    fun networkAndSessionStoreShareTheSameTokenPair() = runTest {
        sessionStore.signIn(AuthTokens("a1", "r1"), UserProfile("c1", "Omar"))
        assertEquals("a1", settings.token.first())
        assertEquals("r1", settings.refreshToken.first())
        settings.setToken("a2")
        settings.setRefreshToken("r2")
        assertEquals(AuthTokens("a2", "r2"), sessionStore.tokens())
    }

    @Test
    fun clearSessionSignsOutButKeepsLanguage() = runTest {
        settings.setLanguage("en")
        sessionStore.signIn(AuthTokens("a1", "r1"), UserProfile("c1", "Omar"))
        settings.clearSession()
        assertNull(settings.token.first())
        assertEquals(SessionState.Guest, sessionStore.state.first())
        assertEquals("en", settings.language.first())
    }
}
