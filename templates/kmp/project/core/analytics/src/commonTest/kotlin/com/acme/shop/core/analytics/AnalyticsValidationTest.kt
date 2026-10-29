package com.acme.shop.core.analytics

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AnalyticsValidationTest {

    @Test
    fun snakeCaseNamesWithinTheLimitAreValid() {
        assertTrue(AnalyticsValidation.isValidName("item_open"))
        assertTrue(AnalyticsValidation.isValidName("a".repeat(AnalyticsLimits.MAX_NAME_LENGTH)))
        assertFalse(AnalyticsValidation.isValidName(""))
        assertFalse(AnalyticsValidation.isValidName("Item Open"))
        assertFalse(AnalyticsValidation.isValidName("1item"))
        assertFalse(AnalyticsValidation.isValidName("a".repeat(AnalyticsLimits.MAX_NAME_LENGTH + 1)))
    }

    @Test
    fun issuesListEveryStructuralProblem() {
        val tooMany = (1..AnalyticsLimits.MAX_PARAMS + 1).associate { "k$it" to AnalyticsValue.Number(it.toLong()) }
        val event = AnalyticsEvent("Bad Name", tooMany + ("Bad Key" to AnalyticsValue.Flag(true)))
        val issues = AnalyticsValidation.issues(event)
        assertTrue(AnalyticsIssue.InvalidName("Bad Name") in issues)
        assertTrue(AnalyticsIssue.InvalidParamKey("Bad Key") in issues)
        assertTrue(AnalyticsIssue.TooManyParams(AnalyticsLimits.MAX_PARAMS + 2) in issues)
    }

    @Test
    fun validEventHasNoIssues() {
        val event = AnalyticsEvent("item_open", analyticsParams { text(AnalyticsKeys.ITEM_ID, "i1") })
        assertEquals(emptyList(), AnalyticsValidation.issues(event))
    }

    @Test
    fun sanitizedTruncatesLongTextValuesOnly() {
        val long = "x".repeat(AnalyticsLimits.MAX_PARAM_VALUE_LENGTH + 20)
        val event = AnalyticsEvent(
            "search_query",
            analyticsParams { text("query", long); number("results", 3); flag("filtered", true) },
        )
        val sanitized = AnalyticsValidation.sanitized(event)
        assertEquals(AnalyticsValue.Text("x".repeat(AnalyticsLimits.MAX_PARAM_VALUE_LENGTH)), sanitized.params["query"])
        assertEquals(AnalyticsValue.Number(3), sanitized.params["results"])
        assertEquals(AnalyticsValue.Flag(true), sanitized.params["filtered"])
    }

    @Test
    fun paramsBuilderKeepsInsertionOrderAndTypes() {
        val params = analyticsParams { text("a", "1"); decimal("b", 2.5); number("c", 3); flag("d", false) }
        assertEquals(listOf("a", "b", "c", "d"), params.keys.toList())
        assertEquals(AnalyticsValue.Decimal(2.5), params["b"])
    }
}
