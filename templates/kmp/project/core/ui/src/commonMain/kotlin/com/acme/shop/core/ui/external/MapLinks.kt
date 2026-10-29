package com.acme.shop.core.ui.external

/** Maps hand-off links, pure and unit-tested; labels are query-encoded. */
object MapLinks {
    private const val SCHEME_SEPARATOR = "://"
    private const val HTTPS = "https"
    private const val GOOGLE_MAPS_WEB = "google.com/maps/search/"
    private const val GOOGLE_MAPS_API = "api=1"
    private const val GOOGLE_MAPS_QUERY = "query"
    private const val GOOGLE_MAPS_APP = "comgooglemaps"
    private const val GOOGLE_MAPS_APP_QUERY = "q"
    private const val APPLE_MAPS_HOST = "maps.apple.com"
    private const val APPLE_MAPS_COORDS = "ll"
    private const val APPLE_MAPS_QUERY = "q"
    private const val GEO_SCHEME = "geo"
    private const val GEO_QUERY = "q"
    private const val COMMA = ","

    /** Android `geo:` URI with a labelled pin, answered by every maps app (Google Maps, Waze, …). */
    fun geo(latitude: Double, longitude: Double, label: String): String =
        "$GEO_SCHEME:$latitude$COMMA$longitude?$GEO_QUERY=$latitude$COMMA$longitude(${ExternalLinks.queryEncode(label)})"

    /** Google Maps web search: opens the Google Maps app when installed, else the browser. */
    fun googleMapsWeb(latitude: Double, longitude: Double): String =
        "$HTTPS$SCHEME_SEPARATOR$GOOGLE_MAPS_WEB?$GOOGLE_MAPS_API&$GOOGLE_MAPS_QUERY=$latitude$COMMA$longitude"

    /** Google Maps iOS app URL (`comgooglemaps://?q=lat,lng`). */
    fun googleMapsApp(latitude: Double, longitude: Double): String =
        "$GOOGLE_MAPS_APP$SCHEME_SEPARATOR?$GOOGLE_MAPS_APP_QUERY=$latitude$COMMA$longitude"

    /** Probe URL for `canOpenURL` (the scheme must be listed in `LSApplicationQueriesSchemes`). */
    fun googleMapsAppProbe(): String = "$GOOGLE_MAPS_APP$SCHEME_SEPARATOR"

    /** Apple Maps universal link with a labelled pin. */
    fun appleMaps(latitude: Double, longitude: Double, label: String): String {
        val query = ExternalLinks.queryEncode(label)
        return "$HTTPS$SCHEME_SEPARATOR$APPLE_MAPS_HOST/?$APPLE_MAPS_COORDS=$latitude$COMMA$longitude&$APPLE_MAPS_QUERY=$query"
    }
}
