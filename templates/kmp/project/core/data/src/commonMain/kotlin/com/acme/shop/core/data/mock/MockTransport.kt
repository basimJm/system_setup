package com.acme.shop.core.data.mock

import com.acme.shop.core.domain.ErrorCode
import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.delay
import kotlinx.io.IOException

private const val PATH_PARAM_PATTERN = "[^/]+"
private const val ARABIC = "ar"
private const val SAMPLE_TEXT_AR = "نص تجريبي"
private const val SAMPLE_TEXT_EN = "Sample text"
private const val OFFLINE_MESSAGE = "mock transport: offline scenario"
private const val TIMEOUT_EXTRA_MS = 1_000L
private const val TRACE_ID = "mock"

/** Marker inside fixture JSON that the transport replaces with sample text in the request language. */
const val MOCK_TEXT_MARKER = "__TEXT__"

/**
 * One fake response of the mock transport: [method] + [pathTemplate] (`/api/v1/items/{id}`) → the backend
 * envelope [json]. Each feature binds its fixtures in its data Koin module; dev builds with `DATA_SOURCE=mock` serve them.
 */
data class MockFixture(val method: String, val pathTemplate: String, val json: String)

/** `GET /api/v1/items/{id}` matches `/api/v1/items/42`; the first matching fixture wins. */
fun matchFixture(method: String, path: String, fixtures: List<MockFixture>): MockFixture? =
    fixtures.firstOrNull { it.method.equals(method, ignoreCase = true) && templateRegex(it.pathTemplate).matches(path) }

private fun templateRegex(template: String): Regex =
    Regex("^" + template.split("/").joinToString("/") { segment ->
        if (segment.startsWith("{")) PATH_PARAM_PATTERN else Regex.escape(segment)
    } + "$")

/** Replaces the text markers of a fixture with sample text in the request language (Accept-Language). */
fun localizeFixture(json: String, language: String?): String =
    json.replace(MOCK_TEXT_MARKER, if (language.orEmpty().startsWith(ARABIC)) SAMPLE_TEXT_AR else SAMPLE_TEXT_EN)

/** Backend error envelope; the message is the code itself (clients branch on `code`, never on server text). */
fun errorEnvelope(code: ErrorCode, path: String? = null): String {
    val details = path?.let { ""","details":{"path":"$it"}""" }.orEmpty()
    return """{"success":false,"message":"${code.name}","error":{"code":"${code.name}"$details,"traceId":"$TRACE_ID"}}"""
}

private fun emptyData(fixture: String): String =
    fixture.replace(Regex("\"data\":\\s*\\[.*]\\s*}$"), "\"data\": []}").replace(Regex("\"data\":\\s*\\{.*}\\s*}$"), "\"data\": null}")

/**
 * Ktor engine that answers from [fixtures] according to [MockScenarios]; unknown paths answer 404 with the backend
 * envelope so a screen hitting an endpoint without a fixture fails visibly.
 */
fun createMockEngine(
    requestTimeoutMs: Long,
    fixtures: List<MockFixture>,
    scenarios: MockScenarios = MockScenarios,
): HttpClientEngine = MockEngine { request ->
    val language = request.headers[HttpHeaders.AcceptLanguage]
    val json = headersOf(HttpHeaders.ContentType, "application/json")
    when (scenarios.current.value) {
        MockScenario.Offline -> throw IOException(OFFLINE_MESSAGE)
        MockScenario.Timeout -> {
            delay(requestTimeoutMs + TIMEOUT_EXTRA_MS)
            respond(errorEnvelope(ErrorCode.INTERNAL), HttpStatusCode.GatewayTimeout, json)
        }
        MockScenario.Unauthorized -> respond(errorEnvelope(ErrorCode.UNAUTHORIZED), HttpStatusCode.Unauthorized, json)
        MockScenario.NotFound -> respond(errorEnvelope(ErrorCode.NOT_FOUND), HttpStatusCode.NotFound, json)
        MockScenario.ServerError -> respond(errorEnvelope(ErrorCode.INTERNAL), HttpStatusCode.InternalServerError, json)
        MockScenario.Success, MockScenario.Empty -> {
            val fixture = matchFixture(request.method.value, request.url.encodedPath, fixtures)?.json
            if (fixture == null) {
                respond(errorEnvelope(ErrorCode.NOT_FOUND, request.url.encodedPath), HttpStatusCode.NotFound, json)
            } else {
                val body = if (scenarios.current.value == MockScenario.Empty) emptyData(fixture) else fixture
                respond(localizeFixture(body, language), HttpStatusCode.OK, json)
            }
        }
    }
}
