package com.acme.shop.core.ui.permission

import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Scripted manager: [initial] is what the system reports, [afterAsking] what it reports once the user answered. */
private class FakeManager(
    private var initial: PermissionStatus,
    private val afterAsking: PermissionStatus,
    private val locationEnabled: Boolean = true,
) : PermissionManager {
    val asked = mutableListOf<AppPermission>()
    val settingsOpened = mutableListOf<AppPermission>()
    var locationSettingsOpened = false

    override suspend fun status(permission: AppPermission) = initial

    override suspend fun request(permission: AppPermission): PermissionStatus {
        asked += permission
        initial = afterAsking
        return afterAsking
    }

    override fun openSettings(permission: AppPermission) {
        settingsOpened += permission
    }

    override fun isLocationServiceEnabled() = locationEnabled

    override fun openLocationServiceSettings() {
        locationSettingsOpened = true
    }
}

class PermissionFlowTest {
    @Test
    fun grantedPermissionNeverShowsADialog() = runTest {
        val manager = FakeManager(PermissionStatus.GRANTED, PermissionStatus.GRANTED)

        val outcome = PermissionFlow(manager).ensure(AppPermission.CAMERA)

        assertEquals(PermissionOutcome.Granted, outcome)
        assertTrue(manager.asked.isEmpty())
    }

    @Test
    fun deniedPermissionIsRequestedOnceAndGrantedWhenTheUserAccepts() = runTest {
        val manager = FakeManager(PermissionStatus.DENIED, PermissionStatus.GRANTED)

        val outcome = PermissionFlow(manager).ensure(AppPermission.LOCATION)

        assertEquals(PermissionOutcome.Granted, outcome)
        assertEquals(listOf(AppPermission.LOCATION), manager.asked)
    }

    @Test
    fun refusalInTheDialogIsReportedAsDeniedSoTheScreenCanExplain() = runTest {
        val manager = FakeManager(PermissionStatus.DENIED, PermissionStatus.DENIED)

        assertEquals(PermissionOutcome.Denied, PermissionFlow(manager).ensure(AppPermission.NOTIFICATIONS))
    }

    @Test
    fun refusalThatTheSystemWillNotAskAgainBecomesBlockedInSettings() = runTest {
        val manager = FakeManager(PermissionStatus.DENIED, PermissionStatus.DENIED_PERMANENTLY)

        assertEquals(PermissionOutcome.BlockedInSettings, PermissionFlow(manager).ensure(AppPermission.CAMERA))
    }

    @Test
    fun permanentlyDeniedPermissionDoesNotTryToShowADialog() = runTest {
        val manager = FakeManager(PermissionStatus.DENIED_PERMANENTLY, PermissionStatus.GRANTED)

        val outcome = PermissionFlow(manager).ensure(AppPermission.CAMERA)

        assertEquals(PermissionOutcome.BlockedInSettings, outcome)
        assertTrue(manager.asked.isEmpty())
    }

    @Test
    fun isGrantedReflectsOnlyTheGrantedStatus() = runTest {
        assertTrue(PermissionFlow(FakeManager(PermissionStatus.GRANTED, PermissionStatus.GRANTED)).isGranted(AppPermission.LOCATION))
        assertFalse(PermissionFlow(FakeManager(PermissionStatus.DENIED, PermissionStatus.GRANTED)).isGranted(AppPermission.LOCATION))
        assertFalse(
            PermissionFlow(FakeManager(PermissionStatus.DENIED_PERMANENTLY, PermissionStatus.GRANTED)).isGranted(AppPermission.LOCATION),
        )
    }

    @Test
    fun settingsAndLocationServiceCallsReachThePlatform() {
        val manager = FakeManager(PermissionStatus.DENIED, PermissionStatus.DENIED, locationEnabled = false)
        val flow = PermissionFlow(manager)

        flow.openSettings(AppPermission.NOTIFICATIONS)
        flow.openLocationServiceSettings()

        assertEquals(listOf(AppPermission.NOTIFICATIONS), manager.settingsOpened)
        assertTrue(manager.locationSettingsOpened)
        assertFalse(flow.isLocationServiceEnabled())
    }
}
