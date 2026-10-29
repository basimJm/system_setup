package com.acme.shop.core.ui.permission

/** Runtime permissions the customer app can ask for (Customer PRD: location, camera, notifications). */
enum class AppPermission {
    NOTIFICATIONS,
    LOCATION,
    CAMERA,
}

enum class PermissionStatus {
    GRANTED,

    /** Not granted, but the system dialog can still be shown. */
    DENIED,

    /** The user refused for good (or policy forbids it): only the system settings can change it. */
    DENIED_PERMANENTLY,
}

/** What a screen has to do after asking. */
sealed interface PermissionOutcome {
    data object Granted : PermissionOutcome

    /** Refused now; the screen may explain and offer to ask again. */
    data object Denied : PermissionOutcome

    /** Refused for good; the screen offers [PermissionManager.openSettings]. */
    data object BlockedInSettings : PermissionOutcome
}
