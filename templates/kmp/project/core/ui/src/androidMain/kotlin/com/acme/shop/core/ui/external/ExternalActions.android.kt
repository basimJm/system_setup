package com.acme.shop.core.ui.external

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import org.koin.core.module.Module
import org.koin.dsl.module

actual val platformExternalActionsModule: Module = module {
    single<ExternalActions> { AndroidExternalActions(get<Context>()) }
}

/**
 * Intents from the application context (`FLAG_ACTIVITY_NEW_TASK`). Handlers are resolved first (the manifest
 * `<queries>` makes them visible on Android 11+), so a device without one answers [ExternalOutcome.Unavailable]
 * instead of an empty chooser or a crash.
 */
class AndroidExternalActions(private val context: Context) : ExternalActions {

    /** PRD : maps chooser over `geo:`; without a maps app the Google Maps web page (browser) takes over. */
    override suspend fun openMaps(latitude: Double, longitude: Double, label: String): ExternalOutcome {
        val geo = view(MapLinks.geo(latitude, longitude, label))
        if (canHandle(geo)) return start(Intent.createChooser(geo, null), ExternalApp.MAPS)
        return start(view(MapLinks.googleMapsWeb(latitude, longitude)), ExternalApp.MAPS)
    }

    /** `ACTION_DIAL` only fills the dialer: no CALL_PHONE permission, the customer presses call. */
    override suspend fun dial(phone: String): ExternalOutcome =
        start(Intent(Intent.ACTION_DIAL, Uri.parse(ExternalLinks.tel(phone))), ExternalApp.DIALER)

    /** `wa.me` is a verified App Link of WhatsApp / WhatsApp Business; without them the browser offers the app. */
    override suspend fun openWhatsApp(phone: String): ExternalOutcome =
        start(view(ExternalLinks.whatsApp(phone)), ExternalApp.WHATSAPP)

    override suspend fun share(text: String): ExternalOutcome {
        val send = Intent(Intent.ACTION_SEND).setType(TEXT_MIME).putExtra(Intent.EXTRA_TEXT, text)
        return start(Intent.createChooser(send, null), ExternalApp.SHARE)
    }

    override suspend fun openUrl(url: String): ExternalOutcome = start(view(url), ExternalApp.BROWSER)

    override suspend fun email(address: String): ExternalOutcome =
        start(Intent(Intent.ACTION_SENDTO, Uri.parse(ExternalLinks.mailto(address))), ExternalApp.EMAIL)

    override suspend fun openApp(appUrl: String, appId: String, fallbackUrl: String): ExternalOutcome {
        val installed = appId.isNotBlank() && context.packageManager.getLaunchIntentForPackage(appId) != null
        return if (installed) start(view(appUrl).setPackage(appId), ExternalApp.BROWSER) else openUrl(fallbackUrl)
    }

    private fun view(url: String) = Intent(Intent.ACTION_VIEW, Uri.parse(url))

    private fun canHandle(intent: Intent): Boolean =
        context.packageManager.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY).isNotEmpty()

    private fun start(intent: Intent, app: ExternalApp): ExternalOutcome = try {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        ExternalOutcome.Opened
    } catch (ignored: ActivityNotFoundException) {
        ExternalOutcome.Unavailable(app)
    } catch (ignored: SecurityException) {
        ExternalOutcome.Unavailable(app)
    }

    private companion object {
        const val TEXT_MIME = "text/plain"
    }
}
