package com.acme.shop.core.network.di

import com.acme.shop.core.common.AppEnvironment
import com.acme.shop.core.domain.AppSettings
import com.acme.shop.core.domain.repository.SessionTimeOut
import com.acme.shop.core.network.client.createHttpClient
import com.acme.shop.core.network.config.ApiConfig
import com.acme.shop.core.network.config.getAuthToken
import com.acme.shop.core.network.client.HttpEngineProvider
import org.koin.dsl.module

val networkModule = module {
    single {
        val environment = get<AppEnvironment>()
        ApiConfig(
            baseUrl = environment.apiBaseUrl,
            authToken = getAuthToken(),
            isDebug = environment.isDebug,
        )
    }
    single { createHttpClient(get(), get<AppSettings>(), get<SessionTimeOut>(), get<HttpEngineProvider>()) }
}
