package com.acme.shop.core.storage.secure

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import com.acme.shop.core.security.KeychainSecureStore
import com.acme.shop.core.security.SecureKeyValueStore
import platform.Foundation.NSBundle

/** Keychain items are scoped by the app's bundle identifier (dev and prod bundles never share a session). */
actual fun createSecureKeyValueStore(dataStore: DataStore<Preferences>): SecureKeyValueStore =
    OffMainSecureStore(KeychainSecureStore(service = NSBundle.mainBundle.bundleIdentifier.orEmpty()))
