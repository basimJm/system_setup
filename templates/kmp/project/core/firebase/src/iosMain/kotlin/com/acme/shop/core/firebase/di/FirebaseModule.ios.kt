package com.acme.shop.core.firebase.di

import com.acme.shop.core.analytics.AnalyticsBackend
import com.acme.shop.core.firebase.AppInstanceIdProvider
import com.acme.shop.core.firebase.CrashReporter
import com.acme.shop.core.firebase.IosAppInstanceIdProvider
import com.acme.shop.core.firebase.IosCrashReporter
import com.acme.shop.core.firebase.IosFirebaseAnalyticsBackend
import com.acme.shop.core.firebase.IosPushTokenProvider
import com.acme.shop.core.firebase.PushTokenProvider
import org.koin.core.module.Module
import org.koin.dsl.module

actual fun platformFirebaseModule(): Module = module {
    single<PushTokenProvider> { IosPushTokenProvider() }
    single<CrashReporter> { IosCrashReporter() }
    single<AnalyticsBackend> { IosFirebaseAnalyticsBackend() }
    single<AppInstanceIdProvider> { IosAppInstanceIdProvider() }
}
