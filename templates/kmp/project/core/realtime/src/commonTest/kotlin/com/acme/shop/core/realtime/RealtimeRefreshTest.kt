package com.acme.shop.core.realtime

import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.time.TestTimeSource

class RealtimeRefreshTest {
    private fun updated(id: String, status: String, at: String = "t1") = RealtimeEvent(
        RealtimeEvents.ENTITY_UPDATED,
        buildJsonObject { put("id", JsonPrimitive(id)); put("status", JsonPrimitive(status)); put("updatedAt", JsonPrimitive(at)) },
    )

    @Test
    fun entityIdReadsIdAndIgnoresOtherPayloads() {
        assertEquals("b1", updated("b1", "APPROVED").entityId())
        assertNull(RealtimeEvent(RealtimeEvents.ENTITY_UPDATED).entityId())
        assertNull(RealtimeEvent(RealtimeEvents.NOTIFICATIONS_UNREAD, JsonPrimitive(3)).updateKey())
    }

    @Test
    fun refreshesFilterByNameAndEntityAndDropConsecutiveDuplicates() = runTest {
        val events = flowOf(
            updated("b1", "APPROVED"),
            updated("b1", "APPROVED"),
            RealtimeEvent(RealtimeEvents.NOTIFICATIONS_UNREAD),
            updated("b2", "APPROVED"),
            updated("b1", "COMPLETED"),
            RealtimeEvent(RealtimeEvents.ENTITY_UPDATED),
            RealtimeEvent(RealtimeEvents.ENTITY_UPDATED),
        )
        assertEquals(5, events.refreshesFor(RealtimeEvents.ENTITY_UPDATED).toList().size, "all entities: 1 duplicate dropped")
        assertEquals(4, events.refreshesFor(RealtimeEvents.ENTITY_UPDATED, entityId = "b1").toList().size, "b1 + the 2 id-less events")
    }

    /** The real `entity.updated` payload (Acme-Server `sockets/ordersEvents.ts` summaryOf): no `updatedAt`. */
    private fun serverSummary(paymentStatus: String) = RealtimeEvent(
        RealtimeEvents.ENTITY_UPDATED,
        Json.parseToJsonElement(
            """{"id":"b1","referenceNumber":"REF-RM7GX8","status":"APPROVED","paymentStatus":"$paymentStatus",
            |"appointmentStart":"2026-10-28T06:00:00.000Z","appointmentEnd":"2026-10-28T06:45:00.000Z",
            |"respondBy":"2026-10-28T06:00:00.000Z","total":"15.000","personsCount":1}""".trimMargin(),
        ),
    )

    @Test
    fun serverSummaryKeyCarriesThePaymentStatus() = runTest {
        assertEquals("b1", serverSummary("PAY_ON_ARRIVAL").entityId())
        val events = flowOf(serverSummary("PAY_ON_ARRIVAL"), serverSummary("PAY_ON_ARRIVAL"), serverSummary("REFUND_PENDING"))
        assertEquals(2, events.refreshesFor(RealtimeEvents.ENTITY_UPDATED, entityId = "b1").toList().size)
    }

    @Test
    fun sameKeyAfterTheDuplicateWindowIsANewChange() = runTest {
        val clock = TestTimeSource()
        val events = flow {
            emit(serverSummary("PAY_ON_ARRIVAL"))
            emit(serverSummary("PAY_ON_ARRIVAL"))
            clock += RealtimeRefreshDefaults.DUPLICATE_WINDOW
            emit(serverSummary("PAY_ON_ARRIVAL"))
        }
        val refreshes = events.refreshesFor(RealtimeEvents.ENTITY_UPDATED, timeSource = clock).toList()
        assertEquals(2, refreshes.size, "replay dropped, reassignment kept")
    }
}
