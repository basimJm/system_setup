package com.acme.shop.core.data.places

import platform.Foundation.NSBundle
import platform.Foundation.NSDictionary
import platform.Foundation.dictionaryWithContentsOfFile

/**
 * iOS implementation of PlacesApiConfig.
 * Reads the API key from Info.plist.
 */
actual object PlacesApiConfig {
    actual val apiKey: String
        get() {
            val bundle = NSBundle.mainBundle
            val infoDictionary = bundle.infoDictionary
            
            // Try to read from Info.plist with key "GooglePlacesApiKey"
            // Developers should add this key to their Info.plist
            return infoDictionary?.get("GooglePlacesApiKey") as? String ?: ""
        }
}
