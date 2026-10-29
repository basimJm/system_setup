package com.acme.shop.app.util

import kotlin.system.exitProcess

/**
 * iOS implementation - exits the process.
 * Note: Apple generally discourages programmatic app termination,
 * but this is acceptable for maintenance mode.
 */
actual fun exitApplication() {
    exitProcess(0)
}
