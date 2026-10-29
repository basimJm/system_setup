package com.acme.shop.app.analytics

import com.acme.shop.core.analytics.AnalyticsContext
import com.acme.shop.core.analytics.AnalyticsContextProvider
import com.acme.shop.core.analytics.AnalyticsUserType
import com.acme.shop.core.common.AppEnvironment
import com.acme.shop.core.domain.AppLanguage
import com.acme.shop.core.domain.session.SessionState
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first

/**
 * Builds the common analytics fields from the app's own sources: environment + version from [AppEnvironment],
 * the current language from the appearance settings flow, user type from the session state, platform from the host.
 */
class AppAnalyticsContextProvider(
    private val environment: AppEnvironment,
    private val language: Flow<AppLanguage>,
    private val session: Flow<SessionState>,
    private val platform: String,
) : AnalyticsContextProvider {

    override suspend fun current(): AnalyticsContext = AnalyticsContext(
        userType = if (session.first().isSignedIn) AnalyticsUserType.REGISTERED else AnalyticsUserType.GUEST,
        language = language.first().code,
        appVersion = environment.appVersion,
        platform = platform,
        environment = environment.name,
    )
}
