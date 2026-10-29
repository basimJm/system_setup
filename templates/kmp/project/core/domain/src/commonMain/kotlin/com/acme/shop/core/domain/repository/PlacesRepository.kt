package com.acme.shop.core.domain.repository

import com.acme.shop.core.domain.model.PlacePrediction

/**
 * Repository for Google Places API operations.
 * Implemented with platform-specific SDKs (Android: Google Places SDK, iOS: MKLocalSearch).
 */
interface PlacesRepository {
    /**
     * Search for places using autocomplete predictions.
     *
     * @param query The search query string
     * @return List of place predictions with names and optional coordinates
     */
    suspend fun searchPlaces(query: String): List<PlacePrediction>

    /**
     * Fetch detailed place information including coordinates.
     * Use this when a user selects a prediction to get lat/lng.
     *
     * @param placeId The place ID from Google Places
     * @return PlacePrediction with lat/lng, or null if fetch fails
     */
    suspend fun fetchPlaceDetails(placeId: String): PlacePrediction?
}
