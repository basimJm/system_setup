package com.acme.shop.core.data.places

/**
 * Configuration for Google Places API.
 * API key is provided via platform-specific implementations.
 */
expect object PlacesApiConfig {
    val apiKey: String
}
