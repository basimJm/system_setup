package com.acme.shop.core.network.client

import com.acme.shop.core.domain.AppSettings
import com.acme.shop.core.domain.repository.SessionTimeOut
import com.acme.shop.core.network.config.ApiConfig
import io.ktor.client.HttpClient

expect fun createHttpClient(
    apiConfig: ApiConfig,
    appSettings: AppSettings,
    sessionTimeOut: SessionTimeOut,
    engineProvider: HttpEngineProvider,
): HttpClient
