package com.acme.shop.core.network.client

import io.ktor.client.plugins.api.createClientPlugin
import io.ktor.http.HttpHeaders

class AcceptLanguagePluginConfig {
    var languageProvider: (suspend () -> String)? = null
}

val AcceptLanguagePlugin = createClientPlugin("AcceptLanguagePlugin", ::AcceptLanguagePluginConfig) {
    val languageProvider = pluginConfig.languageProvider
    onRequest { request, _ ->
        languageProvider?.let { provider ->
            val language = provider()
            if (language.isNotBlank()) {
                request.headers.append(HttpHeaders.AcceptLanguage, language)
            }
        }
    }
}
