package com.acme.shop.core.network.client

import com.acme.shop.core.domain.AppSettings
import com.acme.shop.core.domain.auth.TokenRefreshResult
import com.acme.shop.core.domain.repository.SessionTimeOut
import com.acme.shop.core.network.auth.TokenRefreshCoordinator
import io.ktor.client.HttpClient
import io.ktor.client.call.HttpClientCall
import io.ktor.client.plugins.HttpSend
import io.ktor.client.plugins.ResponseException
import io.ktor.client.plugins.plugin
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import kotlinx.coroutines.flow.first

private const val BEARER_PREFIX = "Bearer "

/** What a send produced: a call, or the [ResponseException] that `expectSuccess` raised for it. */
private class Attempt(private val call: HttpClientCall?, private val error: ResponseException?) {
    val status: HttpStatusCode? get() = call?.response?.status ?: error?.response?.status

    fun unwrap(): HttpClientCall = call ?: throw checkNotNull(error)
}

private fun HttpRequestBuilder.authorize(accessToken: String) {
    headers[HttpHeaders.Authorization] = BEARER_PREFIX + accessToken
}

/**
 * Adds the stored access token to every request. When the backend answers 401 to a request that carried a
 * token, the tokens are refreshed once and the request is repeated with the new access token. The session
 * ends (`SessionTimeOut`) only when the backend rejects the refresh token itself; a refresh that merely
 * could not reach the backend leaves the user signed in and surfaces the original 401.
 */
internal fun HttpClient.installAuthRefresh(
    appSettings: AppSettings,
    coordinator: TokenRefreshCoordinator,
    sessionTimeOut: SessionTimeOut,
) {
    plugin(HttpSend).intercept { request ->
        val sentToken = appSettings.token.first()?.takeIf { it.isNotBlank() }
        sentToken?.let { request.authorize(it) }

        val first = try {
            Attempt(execute(request), null)
        } catch (e: ResponseException) {
            Attempt(null, e)
        }
        if (first.status != HttpStatusCode.Unauthorized || sentToken == null) {
            return@intercept first.unwrap()
        }

        when (val refreshed = coordinator.refreshAfterUnauthorized(sentToken)) {
            is TokenRefreshResult.Refreshed -> {
                val retry = HttpRequestBuilder().takeFrom(request)
                retry.authorize(refreshed.tokens.accessToken)
                execute(retry)
            }

            TokenRefreshResult.Rejected -> {
                sessionTimeOut.sendSessionTimeOut(true)
                first.unwrap()
            }

            TokenRefreshResult.Unavailable -> first.unwrap()
        }
    }
}
