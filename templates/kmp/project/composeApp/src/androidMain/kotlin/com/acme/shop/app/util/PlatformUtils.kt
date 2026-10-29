package com.acme.shop.app.util

import android.os.Process

/**
 * Android implementation - kills the application process.
 */
actual fun exitApplication() {
    Process.killProcess(Process.myPid())
}
