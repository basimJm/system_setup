package com.acme.shop.core.data.location

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import com.acme.shop.core.domain.model.LocationData
import com.acme.shop.core.domain.provider.DeviceLocationProvider
import com.google.android.gms.location.CurrentLocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.google.android.gms.tasks.Task
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * Fused provider: one fresh fix (`getCurrentLocation`, cancelled with the caller), else the last known position,
 * else the platform `LocationManager` (devices without Google Play services). Context comes from Koin (the old
 * code read a Koin property with `!!`), and a missing permission answers null instead of throwing.
 */
class DeviceLocationProviderAndroid(private val context: Context) : DeviceLocationProvider {

    private val fused by lazy { LocationServices.getFusedLocationProviderClient(context) }

    override suspend fun currentLocation(): LocationData? {
        if (!hasPermission()) return null
        val location = freshFix() ?: lastFusedFix() ?: platformLastKnown()
        return location?.let { LocationData(latitude = it.latitude, longitude = it.longitude) }
    }

    private fun hasPermission(): Boolean = PERMISSIONS.any {
        context.checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED
    }

    // Guarded by hasPermission(); lint cannot see through it.
    @SuppressLint("MissingPermission")
    private suspend fun freshFix(): Location? {
        val cancellation = CancellationTokenSource()
        val request = CurrentLocationRequest.Builder()
            .setPriority(Priority.PRIORITY_BALANCED_POWER_ACCURACY)
            .setMaxUpdateAgeMillis(MAX_FIX_AGE_MS)
            .build()
        val task = guarded { fused.getCurrentLocation(request, cancellation.token) } ?: return null
        return task.await { cancellation.cancel() }
    }

    // Guarded by hasPermission(); lint cannot see through it.
    @SuppressLint("MissingPermission")
    private suspend fun lastFusedFix(): Location? = guarded { fused.lastLocation }?.await {}

    // Guarded by hasPermission(); lint cannot see through it.
    @SuppressLint("MissingPermission")
    private fun platformLastKnown(): Location? {
        val manager = context.getSystemService(LocationManager::class.java) ?: return null
        return runCatching {
            manager.getProviders(true).mapNotNull { manager.getLastKnownLocation(it) }.maxByOrNull { it.time }
        }.getOrNull()
    }

    /** Play services missing or the permission revoked between the check and the call. */
    private fun <T> guarded(call: () -> Task<T>): Task<T>? = try {
        call()
    } catch (ignored: SecurityException) {
        null
    } catch (ignored: IllegalStateException) {
        null
    }

    private suspend fun <T> Task<T>.await(onCancel: () -> Unit): T? = suspendCancellableCoroutine { continuation ->
        continuation.invokeOnCancellation { onCancel() }
        addOnCompleteListener { task ->
            if (continuation.isActive) continuation.resume(if (task.isSuccessful) task.result else null)
        }
    }

    private companion object {
        /** A cached fix up to this age is good enough for "items near you". */
        const val MAX_FIX_AGE_MS = 120_000L
        val PERMISSIONS = listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
    }
}
