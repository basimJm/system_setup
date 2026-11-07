package com.acme.shop.core.network.auth

import com.acme.shop.core.domain.auth.AuthTokens
import com.acme.shop.core.domain.auth.TokenRefreshApi
import com.acme.shop.core.domain.auth.TokenRefreshResult
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.HttpRequestTimeoutException
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.HttpStatusCode
import io.ktor.http.isSuccess
import kotlinx.coroutines.CancellationException
import kotlinx.io.IOException
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException

@Serializable
internal data class RefreshRequestDto(
    @SerialName("refreshToken") val refreshToken: String,
)

@Serializable
internal data class RefreshTokensDto(
    @SerialName("accessToken") val accessToken: String,
    @SerialName("refreshToken") val refreshToken: String,
)

/** Base success envelope of the backend (`Acme-Server/CLAUDE.md` §6): `{ success, message, data }`. */
@Serializable
internal data class RefreshResponseDto(
    @SerialName("data") val data: RefreshTokensDto? = null,
)

/**
 * Talks to the refresh endpoint with a client that has no token interceptor, so a failing refresh can never
 * trigger another refresh. 400/401/403/422 mean the refresh token is no longer valid; everything else
 * (timeouts, 5xx, 429, parse problems) leaves the session untouched.
 */
internal class RemoteTokenRefreshApi(
    private val client: HttpClient,
) : TokenRefreshApi {

    override suspend fun refresh(refreshToken: String): TokenRefreshResult = try {
        val response = client.post(AuthEndpoints.REFRESH) { setBody(RefreshRequestDto(refreshToken)) }
        when {
            response.status.isSuccess() -> response.body<RefreshResponseDto>().data
                ?.takeIf { it.accessToken.isNotBlank() && it.refreshToken.isNotBlank() }
                ?.let { TokenRefreshResult.Refreshed(AuthTokens(it.accessToken, it.refreshToken)) }
                ?: TokenRefreshResult.Unavailable

            response.status in REJECTING_STATUSES -> TokenRefreshResult.Rejected
            else -> TokenRefreshResult.Unavailable
        }
    } catch (e: CancellationException) {
        throw e
    } catch (ignored: SerializationException) {
        TokenRefreshResult.Unavailable
    } catch (ignored: HttpRequestTimeoutException) {
        TokenRefreshResult.Unavailable
    } catch (ignored: IOException) {
        TokenRefreshResult.Unavailable
    }

    private companion object {
        val REJECTING_STATUSES = setOf(
            HttpStatusCode.BadRequest,
            HttpStatusCode.Unauthorized,
            HttpStatusCode.Forbidden,
            HttpStatusCode.UnprocessableEntity,
        )
    }
}
