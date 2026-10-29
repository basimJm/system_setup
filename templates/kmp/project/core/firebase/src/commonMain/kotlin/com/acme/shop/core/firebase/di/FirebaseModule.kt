package com.acme.shop.core.firebase.di

import org.koin.core.module.Module

/**
 * Binds `PushTokenProvider`, `CrashReporter`, `AppInstanceIdProvider` and the analytics `AnalyticsBackend` to the
 * platform's Firebase implementation (Android SDK; iOS Swift bridges). Tests bind the fakes instead.
 */
expect fun platformFirebaseModule(): Module
