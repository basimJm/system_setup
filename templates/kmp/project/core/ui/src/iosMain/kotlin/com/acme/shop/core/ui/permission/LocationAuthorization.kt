package com.acme.shop.core.ui.permission

import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import platform.CoreLocation.CLLocationManager
import platform.CoreLocation.CLLocationManagerDelegateProtocol
import platform.CoreLocation.kCLAuthorizationStatusNotDetermined
import platform.darwin.NSObject
import kotlin.coroutines.resume

/** Reports the answer to the one-time location dialog, which CoreLocation only delivers to a delegate. */
@OptIn(ExperimentalForeignApi::class)
internal class LocationAuthorization {
    // CoreLocation delivers delegate callbacks on the run loop of the thread that created the manager: main only.
    private val manager by lazy { CLLocationManager() }

    // CoreLocation keeps its delegate weakly, so the strong reference lives here.
    private var delegate: AnswerDelegate? = null

    suspend fun status(): PermissionStatus = withContext(Dispatchers.Main) { locationStatusOf(manager.authorizationStatus) }

    suspend fun request() = withContext(Dispatchers.Main) {
        if (manager.authorizationStatus != kCLAuthorizationStatusNotDetermined) return@withContext
        suspendCancellableCoroutine { continuation ->
            continuation.invokeOnCancellation { clearDelegate() }
            var answered = false
            val answerDelegate = AnswerDelegate { code ->
                if (!answered && code != kCLAuthorizationStatusNotDetermined) {
                    answered = true
                    if (continuation.isActive) continuation.resume(Unit)
                }
            }
            delegate = answerDelegate
            manager.delegate = answerDelegate
            manager.requestWhenInUseAuthorization()
        }
        clearDelegate()
    }

    private fun clearDelegate() {
        manager.delegate = null
        delegate = null
    }

    private class AnswerDelegate(
        private val onAuthorizationChange: (Int) -> Unit,
    ) : NSObject(), CLLocationManagerDelegateProtocol {
        override fun locationManagerDidChangeAuthorization(manager: CLLocationManager) {
            onAuthorizationChange(manager.authorizationStatus)
        }
    }
}
