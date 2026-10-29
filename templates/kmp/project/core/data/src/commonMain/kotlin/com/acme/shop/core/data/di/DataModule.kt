package com.acme.shop.core.data.di

import com.acme.shop.core.data.places.PlacesApiConfig
import com.acme.shop.core.data.places.PlacesApiService
import io.ktor.client.HttpClient
import org.koin.dsl.module

/** Shared data services; feature repositories live in their own `feature/<name>/data` modules. */
val dataModule = module {
    single { PlacesApiService(get<HttpClient>(), PlacesApiConfig.apiKey) }
}
