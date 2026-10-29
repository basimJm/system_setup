package com.acme.shop.core.common
actual fun logEvent(name: String, params: Map<String, Any>) {}
actual fun logScreen(screenName: String) {}
actual fun logCrash(throwable: Throwable) { android.util.Log.e("CrashReporter", throwable.message ?: "Crash", throwable) }
actual fun setUserId(userId: String?) {}
