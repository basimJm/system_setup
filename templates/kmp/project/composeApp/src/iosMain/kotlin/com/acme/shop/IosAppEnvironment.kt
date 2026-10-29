package com.acme.shop

import com.acme.shop.core.common.AppEnvironment
import com.acme.shop.core.common.DataSource
import kotlin.experimental.ExperimentalNativeApi
import kotlin.native.Platform
import org.koin.core.module.Module
import org.koin.dsl.module
import platform.Foundation.NSBundle

/** Info.plist keys filled from the environment xcconfig (Dev.xcconfig / Prod.xcconfig) and from Xcode. */
internal object InfoPlistKeys {
    const val ENVIRONMENT = "APP_ENV"
    const val API_BASE_URL = "API_BASE_URL"
    const val WEB_BASE_URL = "WEB_BASE_URL"
    const val DATA_SOURCE = "DATA_SOURCE"
    const val VERSION_NAME = "CFBundleShortVersionString"
    const val VERSION_CODE = "CFBundleVersion"
}

internal fun iosAppEnvironmentModule(): Module = module {
    single { readIosAppEnvironment() }
}

/** Fails fast with the missing key, so a misconfigured xcconfig is found on first launch, not as a blank URL later. */
@OptIn(ExperimentalNativeApi::class)
internal fun readIosAppEnvironment(bundle: NSBundle = NSBundle.mainBundle): AppEnvironment = AppEnvironment(
    name = bundle.requireInfoString(InfoPlistKeys.ENVIRONMENT),
    apiBaseUrl = bundle.requireInfoString(InfoPlistKeys.API_BASE_URL),
    webBaseUrl = bundle.requireInfoString(InfoPlistKeys.WEB_BASE_URL),
    appVersion = bundle.requireInfoString(InfoPlistKeys.VERSION_NAME),
    appVersionCode = bundle.requireInfoString(InfoPlistKeys.VERSION_CODE).toIntOrNull()
        ?: error("Info.plist key ${InfoPlistKeys.VERSION_CODE} must be a number"),
    isDebug = Platform.isDebugBinary,
    dataSource = DataSource.fromConfig(bundle.requireInfoString(InfoPlistKeys.DATA_SOURCE)),
)

private fun NSBundle.requireInfoString(key: String): String =
    (objectForInfoDictionaryKey(key) as? String)?.takeIf { it.isNotBlank() }
        ?: error("Info.plist is missing $key; check the xcconfig of the active build configuration")
