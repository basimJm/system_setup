package com.acme.shop.core.network.auth

import com.acme.shop.core.domain.auth.AuthTokens
import com.acme.shop.core.domain.auth.TokenRefreshApi
import com.acme.shop.core.domain.auth.TokenRefreshResult
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull

private const val OLD_ACCESS = "old-access"
private const val OLD_REFRESH = "old-refresh"
private const val NEW_ACCESS = "new-access"
private const val NEW_REFRESH = "new-refresh"
private const val CONCURRENT_REQUESTS = 8

private class ScriptedApi(private val result: TokenRefreshResult) : TokenRefreshApi {
    val presentedTokens = mutableListOf<String>()

    override suspend fun refresh(refreshToken: String): TokenRefreshResult {
        presentedTokens += refreshToken
        return result
    }
}

private val rotated = TokenRefreshResult.Refreshed(AuthTokens(NEW_ACCESS, NEW_REFRESH))

class TokenRefreshCoordinatorTest {
    @Test
    fun rotatesBothTokensAndStoresThem() = runTest {
        val settings = FakeAppSettings(OLD_ACCESS, OLD_REFRESH)
        val api = ScriptedApi(rotated)

        val result = TokenRefreshCoordinator(settings, api).refreshAfterUnauthorized(OLD_ACCESS)

        assertEquals(rotated, result)
        assertEquals(listOf(OLD_REFRESH), api.presentedTokens)
        assertEquals(NEW_ACCESS, settings.token.first())
        assertEquals(NEW_REFRESH, settings.refreshToken.first())
    }

    @Test
    fun concurrentFailuresPresentTheRefreshTokenOnlyOnce() = runTest {
        val settings = FakeAppSettings(OLD_ACCESS, OLD_REFRESH)
        val api = ScriptedApi(rotated)
        val coordinator = TokenRefreshCoordinator(settings, api)

        val results = List(CONCURRENT_REQUESTS) {
            async { coordinator.refreshAfterUnauthorized(OLD_ACCESS) }
        }.awaitAll()

        assertEquals(1, api.presentedTokens.size)
        results.forEach { result ->
            assertIs<TokenRefreshResult.Refreshed>(result)
            assertEquals(NEW_ACCESS, result.tokens.accessToken)
        }
    }

    @Test
    fun reusesTokensAnotherRequestAlreadyRefreshed() = runTest {
        val settings = FakeAppSettings(NEW_ACCESS, NEW_REFRESH)
        val api = ScriptedApi(TokenRefreshResult.Rejected)

        val result = TokenRefreshCoordinator(settings, api).refreshAfterUnauthorized(OLD_ACCESS)

        assertIs<TokenRefreshResult.Refreshed>(result)
        assertEquals(NEW_ACCESS, result.tokens.accessToken)
        assertEquals(emptyList(), api.presentedTokens)
    }

    @Test
    fun withoutRefreshTokenTheSessionIsRejectedWithoutCallingTheBackend() = runTest {
        val settings = FakeAppSettings(OLD_ACCESS, null)
        val api = ScriptedApi(rotated)

        val result = TokenRefreshCoordinator(settings, api).refreshAfterUnauthorized(OLD_ACCESS)

        assertEquals(TokenRefreshResult.Rejected, result)
        assertEquals(emptyList(), api.presentedTokens)
    }

    @Test
    fun rejectedRefreshKeepsStoredTokensForTheCallerToClear() = runTest {
        val settings = FakeAppSettings(OLD_ACCESS, OLD_REFRESH)
        val api = ScriptedApi(TokenRefreshResult.Rejected)

        val result = TokenRefreshCoordinator(settings, api).refreshAfterUnauthorized(OLD_ACCESS)

        assertEquals(TokenRefreshResult.Rejected, result)
        assertEquals(OLD_ACCESS, settings.token.first())
    }

    @Test
    fun unreachableBackendDoesNotEndTheSession() = runTest {
        val settings = FakeAppSettings(OLD_ACCESS, OLD_REFRESH)
        val api = ScriptedApi(TokenRefreshResult.Unavailable)

        val result = TokenRefreshCoordinator(settings, api).refreshAfterUnauthorized(OLD_ACCESS)

        assertEquals(TokenRefreshResult.Unavailable, result)
        assertEquals(OLD_ACCESS, settings.token.first())
        assertEquals(OLD_REFRESH, settings.refreshToken.first())
    }

    @Test
    fun blankStoredAccessTokenStillRefreshesFromTheRefreshToken() = runTest {
        val settings = FakeAppSettings(null, OLD_REFRESH)
        val api = ScriptedApi(rotated)

        TokenRefreshCoordinator(settings, api).refreshAfterUnauthorized(null)

        assertEquals(NEW_ACCESS, settings.token.first())
        assertNull(api.presentedTokens.firstOrNull { it != OLD_REFRESH })
    }
}
