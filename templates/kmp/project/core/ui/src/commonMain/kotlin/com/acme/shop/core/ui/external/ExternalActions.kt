package com.acme.shop.core.ui.external

import org.koin.core.module.Module
import org.koin.dsl.module

/** The kind of app a hand-off needs; picks the localized "not available on this device" text. */
enum class ExternalApp { DIALER, WHATSAPP, MAPS, BROWSER, EMAIL, SHARE }

/** Result of a hand-off: the other app opened, or this device has nothing that can handle it (e.g. no phone app). */
sealed interface ExternalOutcome {
    data object Opened : ExternalOutcome
    data class Unavailable(val app: ExternalApp) : ExternalOutcome
}

/** The app that was missing, or null when the hand-off worked. */
val ExternalOutcome.unavailableApp: ExternalApp? get() = (this as? ExternalOutcome.Unavailable)?.app

/**
 * Hand-offs to other apps: maps, dialer, WhatsApp chat, share sheet, browser, mail.
 * Never throws; a device without a handler answers [ExternalOutcome.Unavailable] so the screen can say so.
 */
interface ExternalActions {
    suspend fun openMaps(latitude: Double, longitude: Double, label: String): ExternalOutcome
    suspend fun dial(phone: String): ExternalOutcome
    suspend fun openWhatsApp(phone: String): ExternalOutcome
    suspend fun share(text: String): ExternalOutcome

    /** Web page in the system browser (store page, partner registration). */
    suspend fun openUrl(url: String): ExternalOutcome

    /** Mail app composer. */
    suspend fun email(address: String): ExternalOutcome

    /** Opens [appUrl] in the app identified by [appId] (package / URL scheme) when installed, else [fallbackUrl] (store page). */
    suspend fun openApp(appUrl: String, appId: String, fallbackUrl: String): ExternalOutcome
}

/** Pure link builders shared by the platforms (unit-tested). */
object ExternalLinks {
    private const val SCHEME_SEPARATOR = "://"
    private const val HTTPS = "https"
    private const val WHATSAPP_HOST = "wa.me"
    private const val TEL_SCHEME = "tel"
    private const val MAILTO_SCHEME = "mailto"
    private const val PATH_SEPARATOR = '/'
    private const val PLUS = '+'
    private val NON_DIGITS = Regex("[^0-9]")

    /** `+` (only when leading) and digits: what dialers and `tel:` URLs accept; spaces, dashes and brackets dropped. */
    fun dialable(phone: String): String {
        val trimmed = phone.trim()
        val digits = trimmed.replace(NON_DIGITS, "")
        return if (trimmed.startsWith(PLUS)) "$PLUS$digits" else digits
    }

    /** `https://wa.me/<digits>`: works with or without the app (the browser hands over to WhatsApp or offers it). */
    fun whatsApp(phone: String): String =
        "$HTTPS$SCHEME_SEPARATOR$WHATSAPP_HOST$PATH_SEPARATOR${phone.replace(NON_DIGITS, "")}"

    fun tel(phone: String): String = "$TEL_SCHEME:${dialable(phone)}"

    fun mailto(address: String): String = "$MAILTO_SCHEME:${address.trim()}"

    /** RFC 3986 query encoding of a label (UTF-8 bytes as %XX; unreserved characters kept). */
    fun queryEncode(value: String): String = buildString {
        value.encodeToByteArray().forEach { byte ->
            val code = byte.toInt() and BYTE_MASK
            val char = code.toChar()
            if (char.isUnreserved()) append(char) else append(PERCENT).append(HEX[code shr NIBBLE]).append(HEX[code and NIBBLE_MASK])
        }
    }

    private fun Char.isUnreserved(): Boolean = this in 'A'..'Z' || this in 'a'..'z' || this in '0'..'9' || this in UNRESERVED

    private const val UNRESERVED = "-_.~"
    private const val PERCENT = '%'
    private const val HEX = "0123456789ABCDEF"
    private const val BYTE_MASK = 0xFF
    private const val NIBBLE = 4
    private const val NIBBLE_MASK = 0x0F
}

/** Recording double for tests and previews; [unavailable] apps answer [ExternalOutcome.Unavailable]. */
class FakeExternalActions(var unavailable: Set<ExternalApp> = emptySet()) : ExternalActions {
    val calls = mutableListOf<String>()

    private fun record(app: ExternalApp, call: String): ExternalOutcome {
        calls += call
        return if (app in unavailable) ExternalOutcome.Unavailable(app) else ExternalOutcome.Opened
    }

    override suspend fun openMaps(latitude: Double, longitude: Double, label: String) =
        record(ExternalApp.MAPS, "maps:$latitude,$longitude:$label")
    override suspend fun dial(phone: String) = record(ExternalApp.DIALER, ExternalLinks.tel(phone))
    override suspend fun openWhatsApp(phone: String) = record(ExternalApp.WHATSAPP, ExternalLinks.whatsApp(phone))
    override suspend fun share(text: String) = record(ExternalApp.SHARE, "share:$text")
    override suspend fun openUrl(url: String) = record(ExternalApp.BROWSER, "url:$url")
    override suspend fun email(address: String) = record(ExternalApp.EMAIL, ExternalLinks.mailto(address))
    override suspend fun openApp(appUrl: String, appId: String, fallbackUrl: String) =
        record(ExternalApp.BROWSER, "app:$appUrl|$appId|$fallbackUrl")
}

expect val platformExternalActionsModule: Module

val externalActionsModule: Module = module {
    includes(platformExternalActionsModule)
}
