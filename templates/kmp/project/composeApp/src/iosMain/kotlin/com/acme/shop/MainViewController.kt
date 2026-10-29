package com.acme.shop

import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.window.ComposeUIViewController
import com.acme.shop.app.deeplink.DeepLinkStore
import com.acme.shop.app.ui.App
import com.acme.shop.app.ui.appModules
import com.acme.shop.core.domain.AppSettings
import com.acme.shop.core.notification.push.PushSignals
import com.acme.shop.core.notification.push.pushNotificationOf
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.koin.core.context.startKoin
import org.koin.mp.KoinPlatform

/**
 * Metal command buffers are encoded on a background thread (`parallelRendering`), so the main thread only
 * runs composition, layout and input; the view stays opaque (no blending with the window behind it).
 */
private const val PARALLEL_RENDERING = true
private const val OPAQUE_ROOT_VIEW = true

// Swift calls this by its type-like name (MainViewControllerKt.MainViewController()).
@Suppress("FunctionNaming")
@OptIn(ExperimentalComposeUiApi::class)
fun MainViewController() = ComposeUIViewController(
    configure = {
        parallelRendering = PARALLEL_RENDERING
        opaque = OPAQUE_ROOT_VIEW
    },
) {
    App(null)
}

// Called from AppDelegate.swift, so the compiler sees no Kotlin caller.
@Suppress("unused")
fun initKoin() {
    startKoin {
        modules(appModules + iosAppEnvironmentModule())
    }
}

// Called from AppDelegate.swift, so the compiler sees no Kotlin caller.
@Suppress("unused")
fun saveFcmToken(token: String) {
    val appSettings: AppSettings = KoinPlatform.getKoin().get()
    CoroutineScope(Dispatchers.Main).launch {
        appSettings.setFcmToken(token)
    }
}

// Called from iOSApp.swift (Universal Links), so the compiler sees no Kotlin caller.
@Suppress("unused")
fun handleDeepLink(url: String): Boolean = KoinPlatform.getKoin().get<DeepLinkStore>().publish(url)

/** APNs `userInfo` → the shared payload (string values only, as FCM sends them). */
private fun pushPayload(userInfo: Map<Any?, *>): Map<String, String> =
    userInfo.entries.mapNotNull { (key, value) -> (key as? String)?.let { k -> (value as? String)?.let { v -> k to v } } }.toMap()

// Called from AppDelegate.swift (foreground delivery), so the compiler sees no Kotlin caller.
@Suppress("unused")
fun pushReceivedInForeground(userInfo: Map<Any?, *>, title: String?, body: String?) {
    pushNotificationOf(pushPayload(userInfo), title, body)?.let(PushSignals::publishReceived)
}

// Called from AppDelegate.swift (tap on a system notification), so the compiler sees no Kotlin caller.
@Suppress("unused")
fun pushTapped(userInfo: Map<Any?, *>, title: String?, body: String?) {
    pushNotificationOf(pushPayload(userInfo), title, body)?.let(PushSignals::tapped)
}
