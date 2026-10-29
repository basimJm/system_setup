package com.acme.shop.core.ui.permission

/** Platform access to runtime permissions; implemented per platform and replaced by a fake in tests. */
interface PermissionManager {
    suspend fun status(permission: AppPermission): PermissionStatus

    /** Shows the system dialog when allowed and returns the status after the user answered. */
    suspend fun request(permission: AppPermission): PermissionStatus

    fun openSettings(permission: AppPermission)

    /** System-wide location switch (GPS), separate from the app's location permission. */
    fun isLocationServiceEnabled(): Boolean

    fun openLocationServiceSettings()
}
