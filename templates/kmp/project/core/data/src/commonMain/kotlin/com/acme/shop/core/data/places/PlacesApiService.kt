package com.acme.shop.core.data.places

import com.acme.shop.core.data.places.dto.PlaceDetailsResponse
import com.acme.shop.core.data.places.dto.PlacesAutocompleteResponse
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter

/**
 * Service for calling Google Places API via HTTP.
 * Works on both Android and iOS from commonMain.
 */
class PlacesApiService(
    private val client: HttpClient,
    private val apiKey: String
) {
    companion object {
        private const val BASE_URL = "https://maps.googleapis.com/maps/api/place"
    }

    /**
     * Search for places using autocomplete predictions.
     *
     * @param query The search query string
     * @return List of place predictions
     */
    suspend fun searchPlaces(query: String): PlacesAutocompleteResponse {
        return client.get("$BASE_URL/autocomplete/json") {
            parameter("input", query)
            parameter("key", apiKey)
        }.body()
    }

    /**
     * Fetch detailed place information including coordinates.
     *
     * @param placeId The place ID from autocomplete
     * @return Place details with lat/lng
     */
    suspend fun getPlaceDetails(placeId: String): PlaceDetailsResponse {
        return client.get("$BASE_URL/details/json") {
            parameter("place_id", placeId)
            parameter("key", apiKey)
            parameter("fields", "place_id,name,formatted_address,geometry")
        }.body()
    }
}
