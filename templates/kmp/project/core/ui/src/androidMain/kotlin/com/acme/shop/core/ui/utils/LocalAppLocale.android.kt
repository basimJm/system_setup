package com.acme.shop.core.ui.utils

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ProvidedValue
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import java.util.Locale

actual object LocalAppLocale {

    private var defaultLocale: Locale? = null

    actual val current: String
        @Composable
        get() = Locale.getDefault().toString()

    @Composable
    actual infix fun provides(value: String?): ProvidedValue<*> {
        val configuration = LocalConfiguration.current

        val systemLocale = defaultLocale ?: Locale.getDefault().also { defaultLocale = it }
        val newLocale = if (value == null) systemLocale else Locale.forLanguageTag(value)

        Locale.setDefault(newLocale)
        configuration.setLocale(newLocale)

        val context = LocalContext.current
        val newContext = context.createConfigurationContext(configuration)

        return LocalContext provides newContext
    }
}
