package com.acme.shop.core.common

actual fun logEvent(name: String, params: Map<String, Any>) {}
actual fun logScreen(screenName: String) {}
actual fun logCrash(throwable: Throwable) {
    platform.Foundation.NSLog(
        "CrashReporter: %s",
        (throwable.message ?: throwable::class.simpleName ?: "Crash")
    )
}

actual fun setUserId(userId: String?) {}
