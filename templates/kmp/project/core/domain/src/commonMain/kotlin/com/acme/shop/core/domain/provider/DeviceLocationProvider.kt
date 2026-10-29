package com.acme.shop.core.domain.provider

import com.acme.shop.core.domain.model.LocationData

/**
 * One current device position for the "nearest" features. The caller has checked the permission and
 * the location service; null when no fix is available. Cancellation (the caller's timeout) stops the request.
 */
interface DeviceLocationProvider {
    suspend fun currentLocation(): LocationData?
}
