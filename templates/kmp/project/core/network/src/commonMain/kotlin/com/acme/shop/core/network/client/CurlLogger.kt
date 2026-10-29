package com.acme.shop.core.network.client

import io.ktor.client.call.save
import io.ktor.client.plugins.api.Send
import io.ktor.client.plugins.api.createClientPlugin
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HeadersBuilder
import io.ktor.http.HttpHeaders
import io.ktor.http.content.OutgoingContent
import kotlin.time.Clock

private const val SANITIZED = "Bearer ***"
private const val BOX_TOP = "╔════════════════════════════════════════════════════════════════"
private const val BOX_DIV = "╠════════════════════════════════════════════════════════════════"
private const val BOX_BTM = "╚════════════════════════════════════════════════════════════════"

val CurlLogger = createClientPlugin("CurlLogger", ::CurlLoggerConfig) {
    val isEnabled = pluginConfig.isDebug

    if (!isEnabled) return@createClientPlugin

    on(Send) { request ->
        val method = request.method.value
        val url = request.url.buildString()
        val headers = request.headers
        val bodyText = request.readBodyText()

        // ── Request ──
        log(BOX_TOP)
        log("║ ➡ REQUEST")
        log(BOX_DIV)
        log("║ Method: $method")
        log("║ URL:    $url")
        log(BOX_DIV)
        log("║ HEADERS:")
        headers.sanitized().forEach { (name, value) ->
            log("║   $name: $value")
        }
        log(BOX_DIV)
        bodyText?.let { log("║ BODY: $it") } ?: log("║ BODY: (empty)")
        log(BOX_BTM)

        // ── Proceed ──
        val startMs = Clock.System.now().toEpochMilliseconds()
        val originalCall = proceed(request)
        val durationMs = Clock.System.now().toEpochMilliseconds() - startMs

        // Buffer the response so body can be read twice (once for log, once for caller)
        val savedCall = originalCall.save()
        val status = savedCall.response.status.value
        val responseBody = savedCall.response.bodyAsText()

        // ── Response ──
        log(BOX_TOP)
        log("║ ⬅ RESPONSE  [$durationMs ms]")
        log(BOX_DIV)
        log("║ Status: $status")
        log("║ URL:    $url")
        log(BOX_DIV)
        responseBody.takeIf { it.isNotEmpty() }
            ?.let { log("║ BODY: $it") }
            ?: log("║ BODY: (empty)")
        log(BOX_BTM)

        // ── cURL ──
        log(BOX_TOP)
        log("║ CURL")
        log("║ ${buildCurl(method, url, headers, bodyText)}")
        log(BOX_BTM)

        savedCall
    }
}

class CurlLoggerConfig {
    var isDebug: Boolean = false
}

// ── Helpers ──────────────────────────────────────────────────────────────────

private fun log(message: String) = networkLog(message)

private fun HeadersBuilder.sanitized(): List<Pair<String, String>> =
    entries().map { (name, values) ->
        name to if (name.equals(HttpHeaders.Authorization, ignoreCase = true))
            SANITIZED else values.joinToString(", ")
    }

private fun HttpRequestBuilder.readBodyText(): String? =
    (body as? OutgoingContent.ByteArrayContent)?.bytes()?.decodeToString()

private fun buildCurl(
    method: String,
    url: String,
    headers: HeadersBuilder,
    body: String?,
): String = buildString {
    append("curl -X $method '$url'")
    headers.sanitized().forEach { (name, value) ->
        append(" -H '$name: $value'")
    }
    body?.takeIf { it.isNotEmpty() }?.let {
        append(" -d '${it.replace("'", "\\'")}'")
    }
}
