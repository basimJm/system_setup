package com.acme.shop.core.data.places

import com.acme.shop.core.data.places.dto.PlaceDetailsResponse
import com.acme.shop.core.data.places.dto.PlacesAutocompleteResponse
import com.acme.shop.core.domain.model.PlacePrediction
import com.acme.shop.core.domain.repository.PlacesRepository

/**
 * Implementation of PlacesRepository using Google Places REST API.
 * Works on both Android and iOS from commonMain.
 */
class PlacesRepositoryImpl(
    private val placesApiService: PlacesApiService
) : PlacesRepository {

    override suspend fun searchPlaces(query: String): List<PlacePrediction> {
        if (query.isBlank()) return emptyList()

        return try {
            val response: PlacesAutocompleteResponse = placesApiService.searchPlaces(query)

            if (response.status == "OK" || response.status == "ZERO_RESULTS") {
                response.predictions.map { prediction ->
                    PlacePrediction(
                        placeId = prediction.placeId,
                        primaryText = prediction.structuredFormatting?.mainText ?: prediction.description,
                        secondaryText = prediction.structuredFormatting?.secondaryText ?: "",
                        lat = null,
                        lng = null
                    )
                }
            } else {
                emptyList()
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    override suspend fun fetchPlaceDetails(placeId: String): PlacePrediction? {
        if (placeId.isBlank()) return null

        return try {
            val response: PlaceDetailsResponse = placesApiService.getPlaceDetails(placeId)

            if (response.status == "OK" && response.result != null) {
                PlacePrediction(
                    placeId = response.result.placeId,
                    primaryText = response.result.name,
                    secondaryText = response.result.formattedAddress,
                    lat = response.result.geometry?.location?.lat,
                    lng = response.result.geometry?.location?.lng
                )
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }
}
