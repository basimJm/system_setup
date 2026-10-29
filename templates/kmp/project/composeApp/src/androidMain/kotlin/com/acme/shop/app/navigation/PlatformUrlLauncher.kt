package com.acme.shop.app.navigation

import android.content.Context
import android.content.Intent
import android.net.Uri

/**
 * Android implementation of URL launcher.
 */
actual class PlatformUrlLauncher actual constructor() : UrlLauncher {
    override fun openUrl(url: String) {
        val context = AppContext.get() ?: return
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        // A device without a browser must not crash the banner tap.
        runCatching { context.startActivity(intent) }
    }
}

/**
 * Singleton to hold application context.
 * Must be initialized in Application class.
 */
object AppContext {
    private var context: Context? = null

    fun initialize(context: Context) {
        this.context = context.applicationContext
    }

    fun get(): Context? = context
}
