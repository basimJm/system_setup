package com.acme.shop.core.network.auth

import com.acme.shop.core.domain.auth.AuthTokens
import com.acme.shop.core.domain.auth.TokenRefreshApi
import com.acme.shop.core.domain.auth.TokenRefreshResult
import com.acme.shop.core.domain.repository.SessionTimeOut
import com.acme.shop.core.network.client.installAuthRefresh
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.ClientRequestException
import io.ktor.client.request.get
import io.ktor.client.request.HttpRequestData
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

private const val OLD_ACCESS = "old-access"
private const val OLD_REFRESH = "old-refresh"
private const val NEW_ACCESS = "new-access"
private const val NEW_REFRESH = "new-refresh"
private const val PATH = "https://api.test/app/v1/items"
private const val CONCURRENT_REQUESTS = 5
private const val BEARER = "Bearer "

private class RecordingSession : SessionTimeOut {
    override val sessionEventTimeOut = Channel<Boolean>(Channel.UNLIMITED)
    val events = mutableListOf<Boolean>()

    override suspend fun sendSessionTimeOut(isTimeOut: Boolean) {
        events += isTimeOut
    }
}

private class ScriptedRefresh(private val result: TokenRefreshResult) : TokenRefreshApi {
    var calls = 0

    override suspend fun refresh(refreshToken: String): TokenRefreshResult {
        calls++
        return result
    }
}

private val rotated = TokenRefreshResult.Refreshed(AuthTokens(NEW_ACCESS, NEW_REFRESH))

/** The backend rejects the old access token and accepts the new one. */
private class Backend {
    val seen = mutableListOf<String?>()

    fun handle(request: HttpRequestData): Pair<HttpStatusCode, String> {
        val header = request.headers[HttpHeaders.Authorization]
        seen += header
        return if (header == BEARER + OLD_ACCESS || header == null) {
            HttpStatusCode.Unauthorized to ""
        } else {
            HttpStatusCode.OK to "ok"
        }
    }
}

private fun httpClient(
    backend: Backend,
    settings: FakeAppSettings,
    refresh: TokenRefreshApi,
    session: SessionTimeOut,
): HttpClient {
    val engine = MockEngine { request ->
        val (status, body) = backend.handle(request)
        respond(body, status)
    }
    val client = HttpClient(engine) { expectSuccess = true }
    client.installAuthRefresh(settings, TokenRefreshCoordinator(settings, refresh), session)
    return client
}

class AuthRefreshInterceptorTest {
    @Test
    fun unauthorizedRequestIsRepeatedOnceWithTheRefreshedToken() = runTest {
        val backend = Backend()
        val settings = FakeAppSettings(OLD_ACCESS, OLD_REFRESH)
        val refresh = ScriptedRefresh(rotated)
        val session = RecordingSession()

        val response = httpClient(backend, settings, refresh, session).get(PATH)

        assertEquals("ok", response.bodyAsText())
        assertEquals(listOf<String?>(BEARER + OLD_ACCESS, BEARER + NEW_ACCESS), backend.seen)
        assertEquals(1, refresh.calls)
        assertEquals(NEW_ACCESS, settings.token.first())
        assertEquals(NEW_REFRESH, settings.refreshToken.first())
        assertTrue(session.events.isEmpty())
    }

    @Test
    fun fiveSimultaneousUnauthorizedRequestsShareOneRefresh() = runTest {
        val backend = Backend()
        val refresh = ScriptedRefresh(rotated)
        val client = httpClient(backend, FakeAppSettings(OLD_ACCESS, OLD_REFRESH), refresh, RecordingSession())

        val bodies = List(CONCURRENT_REQUESTS) { async { client.get(PATH).bodyAsText() } }.awaitAll()

        assertEquals(List(CONCURRENT_REQUESTS) { "ok" }, bodies)
        assertEquals(1, refresh.calls)
    }

    @Test
    fun rejectedRefreshTokenEndsTheSessionAndSurfacesTheOriginalError() = runTest {
        val session = RecordingSession()
        val refresh = ScriptedRefresh(TokenRefreshResult.Rejected)
        val client = httpClient(Backend(), FakeAppSettings(OLD_ACCESS, OLD_REFRESH), refresh, session)

        val error = assertFailsWith<ClientRequestException> { client.get(PATH) }

        assertEquals(HttpStatusCode.Unauthorized, error.response.status)
        assertEquals(listOf(true), session.events)
    }

    @Test
    fun unreachableRefreshEndpointKeepsTheUserSignedIn() = runTest {
        val session = RecordingSession()
        val settings = FakeAppSettings(OLD_ACCESS, OLD_REFRESH)
        val client = httpClient(Backend(), settings, ScriptedRefresh(TokenRefreshResult.Unavailable), session)

        assertFailsWith<ClientRequestException> { client.get(PATH) }

        assertTrue(session.events.isEmpty())
        assertEquals(OLD_ACCESS, settings.token.first())
    }

    @Test
    fun requestWithoutAStoredTokenNeverTriesToRefresh() = runTest {
        val refresh = ScriptedRefresh(rotated)
        val session = RecordingSession()
        val backend = Backend()
        val client = httpClient(backend, FakeAppSettings(), refresh, session)

        assertFailsWith<ClientRequestException> { client.get(PATH) }

        assertEquals(listOf<String?>(null), backend.seen)
        assertEquals(0, refresh.calls)
        assertTrue(session.events.isEmpty())
    }

    @Test
    fun successfulRequestCarriesTheStoredTokenAndNeverRefreshes() = runTest {
        val backend = Backend()
        val refresh = ScriptedRefresh(rotated)
        val client = httpClient(backend, FakeAppSettings(NEW_ACCESS, NEW_REFRESH), refresh, RecordingSession())

        assertEquals("ok", client.get(PATH).bodyAsText())

        assertEquals(listOf<String?>(BEARER + NEW_ACCESS), backend.seen)
        assertEquals(0, refresh.calls)
    }
}
