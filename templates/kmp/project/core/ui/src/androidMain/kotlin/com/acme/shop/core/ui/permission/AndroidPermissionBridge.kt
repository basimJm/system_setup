package com.acme.shop.core.ui.permission

import android.app.Activity
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import kotlinx.coroutines.CompletableDeferred
import java.lang.ref.WeakReference

/**
 * Connects the Activity Result API (which must be registered by an Activity before it starts) to suspending
 * calls. `MainActivity` attaches in `onCreate` and detaches in `onDestroy`.
 */
class AndroidPermissionBridge {
    private var launcher: ActivityResultLauncher<Array<String>>? = null
    private var pending: CompletableDeferred<Map<String, Boolean>>? = null
    private var activityRef: WeakReference<Activity>? = null

    val activity: Activity? get() = activityRef?.get()

    fun attach(activity: ComponentActivity) {
        activityRef = WeakReference(activity)
        launcher = activity.registerForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions(),
        ) { result ->
            pending?.complete(result)
            pending = null
        }
    }

    /**
     * A recreated Activity (rotation, dark mode, language) registers again under the same key and receives the
     * answer, so a pending request is only cancelled when the Activity is really finishing.
     */
    fun detach(finishing: Boolean) {
        launcher?.unregister()
        launcher = null
        activityRef = null
        if (finishing) {
            pending?.cancel()
            pending = null
        }
    }

    /** Shows the system dialog; returns an empty map when no Activity is attached (nothing can be shown). */
    suspend fun request(permissions: Array<String>): Map<String, Boolean> {
        val current = launcher ?: return emptyMap()
        pending?.cancel()
        val answer = CompletableDeferred<Map<String, Boolean>>()
        pending = answer
        current.launch(permissions)
        return answer.await()
    }
}
