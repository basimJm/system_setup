package com.acme.shop.core.data.places

import android.content.pm.PackageManager
import org.koin.mp.KoinPlatform

/**
 * Android implementation of PlacesApiConfig.
 * Reads the API key from AndroidManifest.xml meta-data.
 */
actual object PlacesApiConfig {
    actual val apiKey: String
        get() {
            val context = KoinPlatform.getKoin().getProperty<android.content.Context>("androidContext")
                ?: throw IllegalStateException("Android context not available")
            
            return try {
                val appInfo = context.packageManager.getApplicationInfo(
                    context.packageName,
                    PackageManager.GET_META_DATA
                )
                appInfo.metaData?.getString("com.google.android.geo.API_KEY") ?: ""
            } catch (e: Exception) {
                ""
            }
        }
}
