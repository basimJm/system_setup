package com.acme.shop.app.di

import com.acme.shop.app.analytics.AppAnalyticsContextProvider
import com.acme.shop.app.analytics.SessionAnalyticsSync
import com.acme.shop.core.analytics.AnalyticsContextProvider
import com.acme.shop.core.domain.AppearanceSettings
import com.acme.shop.core.domain.session.SessionStore
import com.acme.shop.getPlatform
import org.koin.dsl.module

/** App-side analytics bindings: the context provider the core tracker needs (user type and scope from the session store). */
val analyticsAppModule = module {
    single { SessionAnalyticsSync(session = get<SessionStore>().state, tracker = get(), crashReporter = get()) }
    single<AnalyticsContextProvider> {
        AppAnalyticsContextProvider(
            environment = get(),
            language = get<AppearanceSettings>().language,
            session = get<SessionStore>().state,
            platform = getPlatform().analyticsName,
        )
    }
}
