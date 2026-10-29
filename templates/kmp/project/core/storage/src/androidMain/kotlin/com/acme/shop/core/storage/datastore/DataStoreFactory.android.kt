package com.acme.shop.core.storage.datastore

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences

private const val DATA_STORE_NAME = "app_settings"

actual fun createDataStore(context: Any?): DataStore<Preferences> {
    val androidContext = context as? Context
        ?: throw IllegalStateException("Context must be provided for Android platform")
    
    return getDataStore(
        producePath = {
            androidContext.filesDir
                .resolve(dataStoreFileName)
                .absolutePath
        }
    )
}

actual val dataStoreFileName: String = "${DATA_STORE_NAME}.preferences_pb"
