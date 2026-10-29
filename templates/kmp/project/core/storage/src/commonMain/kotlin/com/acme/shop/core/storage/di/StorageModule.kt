package com.acme.shop.core.storage.di

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import com.acme.shop.core.domain.AppSettings
import com.acme.shop.core.domain.session.SessionStore
import com.acme.shop.core.security.SecureKeyValueStore
import com.acme.shop.core.storage.AppSettingsImpl
import com.acme.shop.core.storage.DataStoreSessionStorage
import com.acme.shop.core.storage.SessionStorage
import com.acme.shop.core.storage.datastore.createDataStore
import com.acme.shop.core.storage.secure.createSecureKeyValueStore
import com.acme.shop.core.storage.session.DataStoreSessionStore
import com.acme.shop.core.storage.db.AppDatabase
import com.acme.shop.core.storage.db.dao.CachedItemDao
import com.acme.shop.core.storage.db.getDatabaseBuilder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.IO
import org.koin.core.module.dsl.bind
import org.koin.core.module.dsl.singleOf
import org.koin.dsl.module

val storageModule = module {
    single<DataStore<Preferences>> {
        createDataStore(runCatching { getProperty<Any>("androidContext") }.getOrNull())
    }

    single<SecureKeyValueStore> { createSecureKeyValueStore(get()) }
    singleOf(::DataStoreSessionStore) { bind<SessionStore>() }
    singleOf(::AppSettingsImpl) { bind<AppSettings>() }
    singleOf(::DataStoreSessionStorage) { bind<SessionStorage>() }

    single<AppDatabase> {
        getDatabaseBuilder()
            .setQueryCoroutineContext(Dispatchers.IO)
            .build()
    }
    single<CachedItemDao> {
        get<AppDatabase>().getCachedItemDao()
    }
}
