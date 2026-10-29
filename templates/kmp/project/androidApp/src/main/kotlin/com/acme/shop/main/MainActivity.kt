package com.acme.shop.main

import android.content.Intent
import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.acme.shop.app.deeplink.DeepLinkStore
import com.acme.shop.app.ui.App
import com.acme.shop.core.ui.media.AndroidImagePickerBridge
import com.acme.shop.core.notification.push.PushSignals
import com.acme.shop.core.ui.permission.AndroidPermissionBridge
import com.acme.shop.firebase.PushIntents
import org.koin.java.KoinJavaComponent.getKoin

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Lock portrait on phones (< 600dp); tablets/iPad remain free-rotation
        if (resources.configuration.smallestScreenWidthDp < 600) {
            requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        getKoin().get<AndroidPermissionBridge>().attach(this)
        getKoin().get<AndroidImagePickerBridge>().attach(this)
        getKoin().get<DeepLinkStore>().publish(intent?.dataString)
        PushIntents.fromIntent(intent)?.let(PushSignals::tapped)
        setContent {
            App(this)
        }
    }

    /** App Links arriving while the activity is alive (`singleTop`). */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        getKoin().get<DeepLinkStore>().publish(intent.dataString)
        PushIntents.fromIntent(intent)?.let(PushSignals::tapped)
    }

    override fun onDestroy() {
        getKoin().get<AndroidPermissionBridge>().detach(isFinishing)
        getKoin().get<AndroidImagePickerBridge>().detach(isFinishing)
        super.onDestroy()
    }
}
