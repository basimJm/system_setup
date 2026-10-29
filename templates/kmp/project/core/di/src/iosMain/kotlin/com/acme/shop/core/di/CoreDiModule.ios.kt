package com.acme.shop.core.di

import com.acme.shop.core.data.location.DeviceLocationProviderIOS
import com.acme.shop.core.domain.provider.DeviceLocationProvider
import org.koin.dsl.module

actual val deviceLocationProviderModule = module {
    single<DeviceLocationProvider> { DeviceLocationProviderIOS() }
}

val coreDiModuleIos = module {
    // iOS-specific dependencies can be added here
}
