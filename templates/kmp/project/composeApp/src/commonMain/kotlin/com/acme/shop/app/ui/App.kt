package com.acme.shop.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import androidx.navigation.compose.rememberNavController
import com.acme.shop.app.analytics.TrackNavigationScreens
import com.acme.shop.app.controller.contract.MainContract.UiAction
import com.acme.shop.app.controller.vm.MainViewModel
import com.acme.shop.app.deeplink.DeepLinkStore
import com.acme.shop.app.deeplink.deepLinkModule
import com.acme.shop.app.di.analyticsAppModule
import com.acme.shop.app.di.viewModelModule
import com.acme.shop.app.navigation.MainNavigation
import com.acme.shop.app.push.PushEffect
import com.acme.shop.app.realtime.RealtimeConnectionEffect
import com.acme.shop.app.resources.Res
import com.acme.shop.app.resources.unauthorized_logout_message
import com.acme.shop.core.analytics.AnalyticsTracker
import com.acme.shop.core.analytics.compose.LocalAnalyticsTracker
import com.acme.shop.core.analytics.di.analyticsModule
import com.acme.shop.core.data.mock.di.mockDataModule
import com.acme.shop.core.di.coreDiModule
import com.acme.shop.core.domain.ThemeMode
import com.acme.shop.core.domain.session.SessionStore
import com.acme.shop.core.firebase.di.platformFirebaseModule
import com.acme.shop.core.navigation.route.Graph
import com.acme.shop.core.notification.composable.NotificationHost
import com.acme.shop.core.notification.composable.rememberNotificationManager
import com.acme.shop.core.notification.di.notificationModule
import com.acme.shop.core.notification.model.NotificationStyle
import com.acme.shop.core.realtime.RealtimeClient
import com.acme.shop.core.realtime.di.realtimeModule
import com.acme.shop.core.ui.utils.LocalAppLocale
import com.acme.shop.core.ui.utils.LocalDarkTheme
import com.acme.shop.designsystem.components.image.LocalImageLoader
import com.acme.shop.designsystem.components.image.rememberImageLoader
import com.acme.shop.designsystem.theme.AppTheme
import com.acme.shop.feature.sample.di.sampleModule
import com.acme.shop.feature.sample.presentation.di.samplePresentationModule
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.koinInject
import org.koin.compose.viewmodel.koinViewModel

/** Every Koin module of the app: core first, then one pair (data + presentation) per feature. */
val appModules = listOf(
    coreDiModule,
    mockDataModule,
    realtimeModule,
    notificationModule,
    viewModelModule,
    deepLinkModule,
    platformFirebaseModule(),
    analyticsModule(),
    analyticsAppModule,

    // feature modules (add each new feature here, in settings.gradle.kts and in ComposeAppPlugin.FEATURE_MODULES)
    sampleModule,
    samplePresentationModule,
)

/** App shell: theme, language direction, dark mode, image loading, in-app notifications, analytics and navigation. */
@Composable
fun App(androidContext: Any?) {
    val navController: NavHostController = rememberNavController()
    val mainViewModel: MainViewModel = koinViewModel<MainViewModel>()
    val sessionTimeOut by mainViewModel.sessionTimeOutState.collectAsStateWithLifecycle()
    val language by mainViewModel.languageState.collectAsStateWithLifecycle()
    val layoutDirection = if (language.isRtl) LayoutDirection.Rtl else LayoutDirection.Ltr
    val themeMode by mainViewModel.themeMode.collectAsStateWithLifecycle()
    val systemDark = isSystemInDarkTheme()
    val isDarkTheme = when (themeMode) {
        ThemeMode.DARK -> true
        ThemeMode.LIGHT -> false
        ThemeMode.SYSTEM -> systemDark
    }
    val imageLoader = rememberImageLoader()
    val unauthorizedLogoutMessage = stringResource(Res.string.unauthorized_logout_message)

    CompositionLocalProvider(LocalLayoutDirection provides layoutDirection) {
        CompositionLocalProvider(
            LocalImageLoader provides imageLoader,
            LocalAppLocale provides language.code,
            LocalDarkTheme provides isDarkTheme,
            LocalAnalyticsTracker provides koinInject<AnalyticsTracker>(),
        ) {
            AppTheme {
                TrackNavigationScreens(navController)
                val sessionState by koinInject<SessionStore>().state.collectAsStateWithLifecycle(initialValue = null)
                RealtimeConnectionEffect(koinInject<RealtimeClient>(), isSignedIn = sessionState?.isSignedIn == true)
                NotificationHost {
                    val notificationManager = rememberNotificationManager()
                    LaunchedEffect(sessionTimeOut) {
                        if (sessionTimeOut) {
                            notificationManager.show(unauthorizedLogoutMessage, style = NotificationStyle.Error)
                            mainViewModel.onEvent(UiAction.OnSessionTimeOut)
                        }
                    }
                    PushEffect(deepLinks = koinInject<DeepLinkStore>())
                    MainNavigation(Graph.Home, navController)
                }
            }
        }
    }
}
