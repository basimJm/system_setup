package com.acme.shop.core.data

import com.acme.shop.core.data.mock.MOCK_TEXT_MARKER
import com.acme.shop.core.data.mock.MockFixture
import com.acme.shop.core.data.mock.MockScenario
import com.acme.shop.core.data.mock.MockScenarios
import com.acme.shop.core.data.mock.createMockEngine
import com.acme.shop.core.data.mock.localizeFixture
import com.acme.shop.core.data.mock.matchFixture
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import kotlinx.coroutines.test.runTest
import kotlinx.io.IOException
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

private const val ITEM = """{"success":true,"message":"","data":{"id":"i1","title":"$MOCK_TEXT_MARKER"}}"""
private const val LIST = """{"success":true,"message":"","data":[{"id":"i1"}]}"""
private val FIXTURES = listOf(MockFixture("GET", "/api/v1/items/{id}", ITEM), MockFixture("GET", "/api/v1/items", LIST))

class MockTransportTest {
    private val client = HttpClient(createMockEngine(requestTimeoutMs = 10, fixtures = FIXTURES))

    @AfterTest
    fun reset() = MockScenarios.set(MockScenario.Success)

    @Test
    fun matchesTemplatesByMethodAndPath() {
        assertEquals(ITEM, matchFixture("get", "/api/v1/items/42", FIXTURES)?.json)
        assertEquals(LIST, matchFixture("GET", "/api/v1/items", FIXTURES)?.json)
        assertNull(matchFixture("GET", "/api/v1/items/42/extra", FIXTURES))
        assertNull(matchFixture("DELETE", "/api/v1/items", FIXTURES))
    }

    @Test
    fun localizesTextMarkers() {
        assertTrue(localizeFixture(ITEM, "ar").contains("نص تجريبي"))
        assertTrue(localizeFixture(ITEM, "en").contains("Sample text"))
    }

    @Test
    fun scenariosDriveTheResponse() = runTest {
        val ok = client.get("https://mock/api/v1/items/i1") { header(HttpHeaders.AcceptLanguage, "en") }
        assertEquals(HttpStatusCode.OK, ok.status)
        assertTrue(ok.bodyAsText().contains("Sample text"))
        MockScenarios.set(MockScenario.Empty)
        assertTrue(client.get("https://mock/api/v1/items").bodyAsText().contains("\"data\": []"))
        MockScenarios.set(MockScenario.Unauthorized)
        assertEquals(HttpStatusCode.Unauthorized, client.get("https://mock/api/v1/items").status)
        MockScenarios.set(MockScenario.Offline)
        assertFailsWith<IOException> { client.get("https://mock/api/v1/items") }
    }

    @Test
    fun unknownPathsAnswerNotFoundWithTheEnvelope() = runTest {
        val response = client.get("https://mock/api/v1/unknown")
        assertEquals(HttpStatusCode.NotFound, response.status)
        assertTrue(response.bodyAsText().contains("NOT_FOUND"))
    }
}
