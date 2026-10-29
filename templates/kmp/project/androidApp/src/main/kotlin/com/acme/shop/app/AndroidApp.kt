package com.acme.shop.app

import android.app.Application
import android.util.Log
import com.acme.shop.core.domain.AppSettings
import com.acme.shop.core.firebase.PushTokenProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.koin.java.KoinJavaComponent.getKoin
import com.acme.shop.app.ui.appModules
import org.koin.android.ext.koin.androidContext
import org.koin.core.context.GlobalContext.startKoin

class AndroidApp : Application() {

    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        startKoin {
            androidContext(this@AndroidApp)
            properties(mapOf("androidContext" to this@AndroidApp))
            modules(appModules + appEnvironmentModule)
        }

        // FCM token: register (FCM 26) and store it; MyFirebaseMessagingService.onRegistered also stores later refreshes.
        // Resolved on the IO scope: building the DataStore-backed settings and the Firebase provider stays
        // off the main thread, so it never delays the first frame.
        appScope.launch {
            val appSettings: AppSettings = getKoin().get()
            val pushTokens: PushTokenProvider = getKoin().get()
            val token = pushTokens.currentToken()
            if (token != null) {
                appSettings.setFcmToken(token)
                Log.d(FCM_TAG, "Token stored")
            } else {
                Log.w(FCM_TAG, "No FCM token (Firebase not configured or registration failed)")
            }
        }
    }
}

private const val FCM_TAG = "FCM"
