package com.acme.shop.core.ui.utils

import java.util.Locale

actual fun getDefaultLocale(): String {
    return Locale.getDefault().toString()
}
