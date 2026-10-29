package com.acme.shop.app.navigation

/**
 * Platform-specific URL opener interface.
 */
interface UrlLauncher {
    fun openUrl(url: String)
}

/**
 * Expect declaration for URL launcher.
 * Will be implemented by Android and iOS separately.
 */
expect class PlatformUrlLauncher() : UrlLauncher
