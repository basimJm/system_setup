package com.acme.shop.core.di

import android.content.Context
import com.acme.shop.core.data.location.DeviceLocationProviderAndroid
import com.acme.shop.core.domain.provider.DeviceLocationProvider
import org.koin.core.module.Module
import org.koin.dsl.module

actual val deviceLocationProviderModule: Module = module {
    single<DeviceLocationProvider> { DeviceLocationProviderAndroid(get<Context>()) }
}
