package com.acme.shop.core.firebase.di

import com.acme.shop.core.analytics.AnalyticsBackend
import com.acme.shop.core.firebase.AndroidAppInstanceIdProvider
import com.acme.shop.core.firebase.AndroidCrashReporter
import com.acme.shop.core.firebase.AndroidFirebaseAnalyticsBackend
import com.acme.shop.core.firebase.AndroidPushTokenProvider
import com.acme.shop.core.firebase.AppInstanceIdProvider
import com.acme.shop.core.firebase.CrashReporter
import com.acme.shop.core.firebase.PushTokenProvider
import org.koin.android.ext.koin.androidContext
import org.koin.core.module.Module
import org.koin.dsl.module

actual fun platformFirebaseModule(): Module = module {
    single<PushTokenProvider> { AndroidPushTokenProvider() }
    single<CrashReporter> { AndroidCrashReporter() }
    single<AnalyticsBackend> { AndroidFirebaseAnalyticsBackend(androidContext()) }
    single<AppInstanceIdProvider> { AndroidAppInstanceIdProvider(androidContext()) }
}
