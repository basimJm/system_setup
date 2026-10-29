package com.acme.shop.core.domain.auth

/**
 * Outcome of exchanging a refresh token. Only [Rejected] ends the session: [Unavailable] (no network,
 * timeout, server error) must keep the user signed in so a later request can try again.
 */
sealed interface TokenRefreshResult {
    data class Refreshed(val tokens: AuthTokens) : TokenRefreshResult
    data object Rejected : TokenRefreshResult
    data object Unavailable : TokenRefreshResult
}

interface TokenRefreshApi {
    suspend fun refresh(refreshToken: String): TokenRefreshResult
}
