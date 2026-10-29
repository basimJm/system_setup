package com.acme.shop.core.di

import com.acme.shop.core.data.di.dataModule
import com.acme.shop.core.data.places.PlacesRepositoryImpl
import com.acme.shop.core.data.repository.LocalCacheRepositoryImpl
import com.acme.shop.core.data.repository.SessionTimeOutImpl
import com.acme.shop.core.domain.AppearanceSettings
import com.acme.shop.core.domain.repository.LocalCacheRepository
import com.acme.shop.core.domain.repository.PlacesRepository
import com.acme.shop.core.domain.repository.SessionTimeOut
import com.acme.shop.core.network.di.networkModule
import com.acme.shop.core.storage.di.storageModule
import com.acme.shop.core.ui.external.externalActionsModule
import com.acme.shop.core.ui.permission.permissionModule
import org.koin.core.module.Module
import org.koin.core.module.dsl.bind
import org.koin.core.module.dsl.singleOf
import org.koin.dsl.module

expect val deviceLocationProviderModule: Module

val coreDiModule = module {
    singleOf(::LocalCacheRepositoryImpl) { bind<LocalCacheRepository>() }
    singleOf(::PlacesRepositoryImpl) { bind<PlacesRepository>() }
    singleOf(::SessionTimeOutImpl) { bind<SessionTimeOut>() }
    singleOf(::AppearanceSettings)
    includes(storageModule, dataModule, networkModule, deviceLocationProviderModule, permissionModule, externalActionsModule)
}
