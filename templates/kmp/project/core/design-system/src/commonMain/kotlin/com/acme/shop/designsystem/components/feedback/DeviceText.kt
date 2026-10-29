package com.acme.shop.designsystem.components.feedback

import com.acme.shop.core.ui.external.ExternalApp
import com.acme.shop.core.ui.media.PickResult
import com.acme.shop.designsystem.resources.Res
import com.acme.shop.designsystem.resources.external_unavailable_browser
import com.acme.shop.designsystem.resources.external_unavailable_dialer
import com.acme.shop.designsystem.resources.external_unavailable_email
import com.acme.shop.designsystem.resources.external_unavailable_maps
import com.acme.shop.designsystem.resources.external_unavailable_share
import com.acme.shop.designsystem.resources.external_unavailable_whatsapp
import com.acme.shop.designsystem.resources.photo_camera_denied
import com.acme.shop.designsystem.resources.photo_camera_unavailable
import com.acme.shop.designsystem.resources.photo_read_failed
import org.jetbrains.compose.resources.StringResource
import org.jetbrains.compose.resources.getString

/** Text resource for "this device cannot open <app>" (pure, unit-tested). */
fun externalUnavailableResource(app: ExternalApp): StringResource = when (app) {
    ExternalApp.DIALER -> Res.string.external_unavailable_dialer
    ExternalApp.WHATSAPP -> Res.string.external_unavailable_whatsapp
    ExternalApp.MAPS -> Res.string.external_unavailable_maps
    ExternalApp.BROWSER -> Res.string.external_unavailable_browser
    ExternalApp.EMAIL -> Res.string.external_unavailable_email
    ExternalApp.SHARE -> Res.string.external_unavailable_share
}

/** Localized "not available on this device" message for ViewModels (like [appErrorText]). */
suspend fun externalUnavailableText(app: ExternalApp): String = getString(externalUnavailableResource(app))

/** Message for a picker result the customer should hear about; null for a photo or a plain cancel. */
fun pickProblemResource(result: PickResult): StringResource? = when (result) {
    PickResult.CameraUnavailable -> Res.string.photo_camera_unavailable
    PickResult.Failed -> Res.string.photo_read_failed
    PickResult.Cancelled, is PickResult.Picked -> null
}

suspend fun pickProblemText(result: PickResult): String? = pickProblemResource(result)?.let { getString(it) }

/** The camera permission was refused (the dialog can still be shown next time). */
suspend fun cameraDeniedText(): String = getString(Res.string.photo_camera_denied)
