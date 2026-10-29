package com.acme.shop.core.analytics.di

import com.acme.shop.core.analytics.AnalyticsBackend
import com.acme.shop.core.analytics.AnalyticsContextProvider
import com.acme.shop.core.analytics.AnalyticsIssueReporter
import com.acme.shop.core.analytics.AnalyticsTracker
import com.acme.shop.core.analytics.DefaultAnalyticsTracker
import com.acme.shop.core.analytics.NoOpAnalyticsBackend
import com.acme.shop.core.analytics.NoOpAnalyticsIssueReporter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Binds the tracker. The app must bind an [AnalyticsContextProvider]; the [AnalyticsBackend] comes from Koin
 * (the Firebase module binds it) or from [backend], and falls back to no-op so tests and previews run without Firebase.
 */
fun analyticsModule(
    backend: AnalyticsBackend? = null,
    issueReporter: AnalyticsIssueReporter = NoOpAnalyticsIssueReporter,
): Module = module {
    if (backend != null) single<AnalyticsBackend> { backend }
    single<AnalyticsIssueReporter> { issueReporter }
    single<AnalyticsTracker> {
        DefaultAnalyticsTracker(
            backend = getOrNull<AnalyticsBackend>() ?: NoOpAnalyticsBackend,
            contextProvider = get<AnalyticsContextProvider>(),
            scope = CoroutineScope(SupervisorJob() + Dispatchers.Default),
            issueReporter = get(),
        )
    }
}
