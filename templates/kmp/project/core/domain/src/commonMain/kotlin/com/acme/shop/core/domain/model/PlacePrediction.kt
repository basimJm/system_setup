package com.acme.shop.core.domain.model

/**
 * Data class representing a place prediction for search results.
 * Used by PlacesRepository to return autocomplete suggestions.
 */
data class PlacePrediction(
    val placeId: String,
    val primaryText: String,
    val secondaryText: String,
    val lat: Double? = null,
    val lng: Double? = null
)
