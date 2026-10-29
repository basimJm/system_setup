package com.acme.shop.core.ui.external

import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.useContents
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.koin.core.module.Module
import org.koin.dsl.module
import platform.CoreGraphics.CGRectMake
import platform.UIKit.UIActivityViewController
import platform.UIKit.popoverPresentationController

actual val platformExternalActionsModule: Module = module {
    single<ExternalActions> { IosExternalActions() }
}

/**
 * Every hand-off goes through [IosSystem.open] (completion handler tells whether something opened it).
 * Maps: Google Maps app when installed, else Apple Maps.
 */
class IosExternalActions : ExternalActions {

    override suspend fun openMaps(latitude: Double, longitude: Double, label: String): ExternalOutcome {
        if (IosSystem.canOpen(MapLinks.googleMapsAppProbe()) && IosSystem.open(MapLinks.googleMapsApp(latitude, longitude))) {
            return ExternalOutcome.Opened
        }
        return open(MapLinks.appleMaps(latitude, longitude, label), ExternalApp.MAPS)
    }

    override suspend fun dial(phone: String) = open(ExternalLinks.tel(phone), ExternalApp.DIALER)

    override suspend fun openWhatsApp(phone: String) = open(ExternalLinks.whatsApp(phone), ExternalApp.WHATSAPP)

    @OptIn(ExperimentalForeignApi::class)
    override suspend fun share(text: String): ExternalOutcome = withContext(Dispatchers.Main) {
        val top = IosSystem.topViewController() ?: return@withContext ExternalOutcome.Unavailable(ExternalApp.SHARE)
        val controller = UIActivityViewController(activityItems = listOf(text), applicationActivities = null)
        // iPad presents the sheet as a popover, which needs an anchor or UIKit raises an exception.
        controller.popoverPresentationController?.let { popover ->
            popover.sourceView = top.view
            val (width, height) = top.view.bounds.useContents { size.width to size.height }
            popover.sourceRect = CGRectMake(width / HALF, height / HALF, 0.0, 0.0)
        }
        top.presentViewController(controller, animated = true, completion = null)
        ExternalOutcome.Opened
    }

    override suspend fun openUrl(url: String) = open(url, ExternalApp.BROWSER)

    override suspend fun email(address: String) = open(ExternalLinks.mailto(address), ExternalApp.EMAIL)

    /** [appId] is the partner app's URL scheme (declared in `LSApplicationQueriesSchemes`). */
    override suspend fun openApp(appUrl: String, appId: String, fallbackUrl: String): ExternalOutcome {
        val installed = appId.isNotBlank() && IosSystem.canOpen("$appId$SCHEME_SEPARATOR")
        return open(if (installed) appUrl else fallbackUrl, ExternalApp.BROWSER)
    }

    private suspend fun open(url: String, app: ExternalApp): ExternalOutcome =
        if (IosSystem.open(url)) ExternalOutcome.Opened else ExternalOutcome.Unavailable(app)

    private companion object {
        const val SCHEME_SEPARATOR = "://"
        const val HALF = 2.0
    }
}
