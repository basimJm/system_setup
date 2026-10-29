package com.acme.shop.core.network.client

import com.acme.shop.core.domain.AppSettings
import com.acme.shop.core.domain.repository.SessionTimeOut
import com.acme.shop.core.network.auth.RemoteTokenRefreshApi
import com.acme.shop.core.network.auth.TokenRefreshCoordinator
import com.acme.shop.core.network.config.ApiConfig
import io.ktor.client.HttpClient
import io.ktor.client.HttpClientConfig
import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.plugins.DefaultRequest
import io.ktor.client.plugins.HttpRequestRetry
import io.ktor.client.plugins.HttpTimeout
import io.ktor.http.HttpMethod
import kotlinx.coroutines.CancellationException
import com.acme.shop.core.network.NetworkDefaults
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.URLProtocol
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.flow.first

expect fun provideHttpClientEngine(): HttpClientEngine

/** Who creates the transport: the platform engine, or the fixture engine of `core/data` in mock builds. */
fun interface HttpEngineProvider {
    fun create(): HttpClientEngine
}

object PlatformEngineProvider : HttpEngineProvider {
    override fun create(): HttpClientEngine = provideHttpClientEngine()
}

class BaseHttpClient(
    private val config: ApiConfig,
    private val appSettings: AppSettings,
    private val sessionTimeOut: SessionTimeOut,
    private val engineProvider: HttpEngineProvider = PlatformEngineProvider,
) {
    private fun HttpClientConfig<*>.installCommon(logRequests: Boolean) {
        if (logRequests) {
            install(CurlLogger) {
                isDebug = config.isDebug
            }
        }
        install(ContentNegotiation) {
            json(NetworkJson.json, contentType = ContentType.Application.Json)
        }

        install(HttpTimeout) {
            requestTimeoutMillis = config.sendTimeout
            socketTimeoutMillis = config.receiveTimeout
            connectTimeoutMillis = config.connectTimeout
        }

        install(DefaultRequest.Plugin) {
            headers.append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            headers.append(HttpHeaders.Accept, ContentType.Application.Json.toString())
            url {
                val base = config.baseUrl.trim()
                require(base.isNotBlank()) {
                    "API base URL is blank. Set DEV_API_BASE_URL / PROD_API_BASE_URL (Android) " +
                        "or API_BASE_URL in the environment xcconfig (iOS)."
                }
                val withoutScheme = base.removePrefix("https://").removePrefix("http://").trim()
                val hostPart = withoutScheme.split("/").firstOrNull()?.trim() ?: ""
                require(hostPart.isNotBlank()) {
                    "API base URL has no host: $base"
                }
                val hostAndPort = hostPart.split(":")
                host = when (hostAndPort.size) {
                    1 -> hostAndPort[0]
                    else -> hostAndPort.dropLast(1).joinToString(":")
                }
                val portPart = hostAndPort.lastOrNull()?.toIntOrNull()
                if (portPart != null && portPart in 1..65535) {
                    port = portPart
                }
                protocol = when {
                    base.startsWith("https://") -> URLProtocol.HTTPS
                    else -> URLProtocol.HTTP
                }
            }
        }

        install(AcceptLanguagePlugin) {
            languageProvider = { appSettings.language.first() }
        }

        // Only idempotent reads are retried; writes (orders, payments) must never be replayed by the client.
        install(HttpRequestRetry) {
            maxRetries = NetworkDefaults.MAX_RETRIES
            retryIf { request, response ->
                request.method == HttpMethod.Get && response.status.value >= NetworkDefaults.SERVER_ERROR_RANGE_START
            }
            retryOnExceptionIf { request, cause ->
                request.method == HttpMethod.Get && cause !is CancellationException
            }
            exponentialDelay(
                baseDelayMs = NetworkDefaults.RETRY_BASE_DELAY_MS,
                maxDelayMs = NetworkDefaults.RETRY_MAX_DELAY_MS,
            )
        }
    }

    /**
     * Client for the refresh call: no token interceptor (it can never recurse into another refresh) and no
     * request logger (its body carries the refresh token).
     */
    private fun buildRefreshClient() = HttpClient(engineProvider.create()) {
        installCommon(logRequests = false)
        expectSuccess = false
    }

    fun buildHttpClient(): HttpClient {
        val coordinator = TokenRefreshCoordinator(appSettings, RemoteTokenRefreshApi(buildRefreshClient()))
        return HttpClient(engineProvider.create()) {
            installCommon(logRequests = true)
            expectSuccess = true
        }.also { it.installAuthRefresh(appSettings, coordinator, sessionTimeOut) }
    }
}
