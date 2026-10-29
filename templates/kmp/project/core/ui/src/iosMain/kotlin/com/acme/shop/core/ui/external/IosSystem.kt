package com.acme.shop.core.ui.external

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import platform.Foundation.NSURL
import platform.UIKit.UIApplication
import platform.UIKit.UISceneActivationStateForegroundActive
import platform.UIKit.UIViewController
import platform.UIKit.UIWindow
import platform.UIKit.UIWindowScene
import kotlin.coroutines.resume

/** UIKit helpers shared by the iOS hand-offs, pickers and permission screens; all run on the main thread. */
object IosSystem {

    /**
     * `UIApplication.open(_:options:completionHandler:)`: the deprecated `openURL:` is a no-op that returns NO on
     * iOS 18+, which is why calls / WhatsApp / maps / settings did nothing. False = nothing on this device opens it
     * (e.g. `tel:` on the simulator).
     */
    suspend fun open(url: String): Boolean = withContext(Dispatchers.Main) {
        val nsUrl = NSURL.URLWithString(url) ?: return@withContext false
        suspendCancellableCoroutine { continuation ->
            UIApplication.sharedApplication.openURL(nsUrl, options = emptyMap<Any?, Any>()) { success ->
                if (continuation.isActive) continuation.resume(success)
            }
        }
    }

    /** Fire-and-forget variant for callers that do not need the answer (settings app). */
    fun launch(url: String) {
        val nsUrl = NSURL.URLWithString(url) ?: return
        UIApplication.sharedApplication.openURL(nsUrl, options = emptyMap<Any?, Any>(), completionHandler = null)
    }

    /** `canOpenURL` for a scheme declared in `LSApplicationQueriesSchemes` (Info.plist). */
    suspend fun canOpen(url: String): Boolean = withContext(Dispatchers.Main) {
        val nsUrl = NSURL.URLWithString(url) ?: return@withContext false
        UIApplication.sharedApplication.canOpenURL(nsUrl)
    }

    /** The controller on top of the key window of the foreground scene (Compose host or anything it presented). */
    fun topViewController(): UIViewController? {
        var top = keyWindow()?.rootViewController ?: return null
        var presented = top.presentedViewController
        while (presented != null && !presented.isBeingDismissed()) {
            top = presented
            presented = top.presentedViewController
        }
        return top
    }

    private fun keyWindow(): UIWindow? {
        val scenes = UIApplication.sharedApplication.connectedScenes.filterIsInstance<UIWindowScene>()
        val active = scenes.firstOrNull { it.activationState == UISceneActivationStateForegroundActive } ?: scenes.firstOrNull()
        val windows = active?.windows?.filterIsInstance<UIWindow>().orEmpty()
        return windows.firstOrNull { it.isKeyWindow() } ?: windows.firstOrNull()
    }
}
