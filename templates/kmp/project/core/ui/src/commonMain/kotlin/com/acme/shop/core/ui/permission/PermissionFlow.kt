package com.acme.shop.core.ui.permission

/**
 * The single decision every screen shares: ask only when the system allows asking, and report a permanent
 * refusal so the UI can offer the settings instead of showing a dialog that never appears.
 */
class PermissionFlow(private val manager: PermissionManager) {

    suspend fun ensure(permission: AppPermission): PermissionOutcome =
        when (manager.status(permission)) {
            PermissionStatus.GRANTED -> PermissionOutcome.Granted
            PermissionStatus.DENIED_PERMANENTLY -> PermissionOutcome.BlockedInSettings
            PermissionStatus.DENIED -> manager.request(permission).toOutcome()
        }

    suspend fun isGranted(permission: AppPermission): Boolean =
        manager.status(permission) == PermissionStatus.GRANTED

    fun openSettings(permission: AppPermission) = manager.openSettings(permission)

    fun isLocationServiceEnabled(): Boolean = manager.isLocationServiceEnabled()

    fun openLocationServiceSettings() = manager.openLocationServiceSettings()

    private fun PermissionStatus.toOutcome(): PermissionOutcome = when (this) {
        PermissionStatus.GRANTED -> PermissionOutcome.Granted
        PermissionStatus.DENIED -> PermissionOutcome.Denied
        PermissionStatus.DENIED_PERMANENTLY -> PermissionOutcome.BlockedInSettings
    }
}
