package com.acme.shop.core.data.places.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Response from Google Places Autocomplete API.
 * https://developers.google.com/maps/documentation/places/web-service/autocomplete
 */
@Serializable
data class PlacesAutocompleteResponse(
    @SerialName("predictions") val predictions: List<PlacePredictionDto> = emptyList(),
    @SerialName("status") val status: String = ""
)

@Serializable
data class PlacePredictionDto(
    @SerialName("description") val description: String = "",
    @SerialName("place_id") val placeId: String = "",
    @SerialName("structured_formatting") val structuredFormatting: StructuredFormatting? = null,
    @SerialName("terms") val terms: List<PlaceTerm> = emptyList()
)

@Serializable
data class StructuredFormatting(
    @SerialName("main_text") val mainText: String = "",
    @SerialName("secondary_text") val secondaryText: String? = null
)

@Serializable
data class PlaceTerm(
    @SerialName("offset") val offset: Int = 0,
    @SerialName("value") val value: String = ""
)

/**
 * Response from Google Places Details API.
 * https://developers.google.com/maps/documentation/places/web-service/details
 */
@Serializable
data class PlaceDetailsResponse(
    @SerialName("result") val result: PlaceDetailsResult? = null,
    @SerialName("status") val status: String = ""
)

@Serializable
data class PlaceDetailsResult(
    @SerialName("place_id") val placeId: String = "",
    @SerialName("name") val name: String = "",
    @SerialName("formatted_address") val formattedAddress: String = "",
    @SerialName("geometry") val geometry: Geometry? = null
)

@Serializable
data class Geometry(
    @SerialName("location") val location: Location? = null
)

@Serializable
data class Location(
    @SerialName("lat") val lat: Double = 0.0,
    @SerialName("lng") val lng: Double = 0.0
)
