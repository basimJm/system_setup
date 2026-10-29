package com.acme.shop.core.common

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AppEnvironmentTest {

    private fun environment(
        name: String = AppEnvironmentNames.DEV,
        apiBaseUrl: String = TEST_URL,
        webBaseUrl: String = TEST_URL,
        appVersion: String = TEST_VERSION,
        appVersionCode: Int = TEST_VERSION_CODE,
    ) = AppEnvironment(
        name = name,
        apiBaseUrl = apiBaseUrl,
        webBaseUrl = webBaseUrl,
        appVersion = appVersion,
        appVersionCode = appVersionCode,
        isDebug = true,
    )

    @Test
    fun validEnvironmentKeepsItsValues() {
        val result = environment()
        assertEquals(TEST_URL, result.apiBaseUrl)
        assertEquals(TEST_VERSION, result.appVersion)
        assertEquals(TEST_VERSION_CODE, result.appVersionCode)
    }

    @Test
    fun devAndProdFlagsFollowTheName() {
        assertTrue(environment(AppEnvironmentNames.DEV).isDev)
        assertFalse(environment(AppEnvironmentNames.DEV).isProd)
        assertTrue(environment(AppEnvironmentNames.PROD).isProd)
        assertFalse(environment(AppEnvironmentNames.PROD).isDev)
    }

    @Test
    fun blankValuesAreRejectedAtStartup() {
        assertFailsWith<IllegalArgumentException> { environment(name = " ") }
        assertFailsWith<IllegalArgumentException> { environment(apiBaseUrl = "") }
        assertFailsWith<IllegalArgumentException> { environment(webBaseUrl = " ") }
        assertFailsWith<IllegalArgumentException> { environment(appVersion = "  ") }
    }

    @Test
    fun negativeVersionCodeIsRejected() {
        assertFailsWith<IllegalArgumentException> { environment(appVersionCode = NEGATIVE_VERSION_CODE) }
    }

    private companion object {
        const val TEST_URL = "https://test.invalid"
        const val TEST_VERSION = "2.3.4"
        const val TEST_VERSION_CODE = 7
        const val NEGATIVE_VERSION_CODE = -1
    }

    @Test
    fun dataSourceComesFromConfigAndProdRefusesMock() {
        assertEquals(DataSource.MOCK, DataSource.fromConfig(" Mock "))
        assertEquals(DataSource.REMOTE, DataSource.fromConfig("remote"))
        assertFailsWith<IllegalStateException> { DataSource.fromConfig("fixtures") }
        assertTrue(environment().copy(dataSource = DataSource.MOCK).usesMock)
        assertFailsWith<IllegalArgumentException> { environment(name = AppEnvironmentNames.PROD).copy(dataSource = DataSource.MOCK) }
    }
}
