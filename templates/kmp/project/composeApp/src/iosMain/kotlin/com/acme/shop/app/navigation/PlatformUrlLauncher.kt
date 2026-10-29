package com.acme.shop.app.navigation

import com.acme.shop.core.ui.external.IosSystem

/**
 * iOS implementation of URL launcher.
 */
actual class PlatformUrlLauncher actual constructor() : UrlLauncher {
    override fun openUrl(url: String) = IosSystem.launch(url)
}
