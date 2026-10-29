package com.acme.shop.firebase

import android.content.Context
import android.content.Intent
import com.acme.shop.core.notification.push.PushKeys
import com.acme.shop.core.notification.push.PushNotification
import com.acme.shop.core.notification.push.pushNotificationOf
import com.acme.shop.main.MainActivity

/** Carries a tapped system push into `MainActivity` as plain string extras. */
object PushIntents {
    private const val EXTRA_PREFIX = "com.acme.shop.push."
    private const val EXTRA_MARKER = EXTRA_PREFIX + "present"

    fun toActivity(context: Context, notification: PushNotification): Intent =
        Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra(EXTRA_MARKER, true)
            putExtra(EXTRA_PREFIX + PushKeys.TITLE, notification.title)
            putExtra(EXTRA_PREFIX + PushKeys.BODY, notification.message)
            notification.data.forEach { (key, value) -> putExtra(EXTRA_PREFIX + key, value) }
        }

    fun fromIntent(intent: Intent?): PushNotification? {
        val extras = intent?.extras ?: return null
        if (!extras.getBoolean(EXTRA_MARKER, false)) return null
        val data = extras.keySet()
            .filter { it.startsWith(EXTRA_PREFIX) && it != EXTRA_MARKER }
            .mapNotNull { key -> extras.getString(key)?.let { key.removePrefix(EXTRA_PREFIX) to it } }
            .toMap()
        return pushNotificationOf(data)
    }
}
