package com.acme.shop

import com.acme.shop.core.ui.external.IosSystem
import platform.UIKit.UIDevice
import platform.posix.exit

class IOSPlatform : Platform {
    override val name: String =
        UIDevice.currentDevice.systemName() + " " + UIDevice.currentDevice.systemVersion
    override val analyticsName: String = PlatformNames.IOS
    override val osVersion: String = UIDevice.currentDevice.systemVersion
    override val deviceModel: String = UIDevice.currentDevice.model
}

actual fun getPlatform(): Platform = IOSPlatform()

actual fun openStoreLink(url: String?) {
    // `openURL:` (deprecated) does nothing on iOS 18+; IosSystem uses open(_:options:completionHandler:).
    url?.takeIf { it.isNotBlank() }?.let(IosSystem::launch)
}

actual fun exitApp() {
    exit(0)
}
