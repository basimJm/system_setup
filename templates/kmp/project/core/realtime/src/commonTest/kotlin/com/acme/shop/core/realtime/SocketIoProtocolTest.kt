package com.acme.shop.core.realtime

import com.acme.shop.core.realtime.socketio.EngineIoPacket
import com.acme.shop.core.realtime.socketio.SocketIoPacket
import com.acme.shop.core.realtime.socketio.SocketIoProtocol
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class SocketIoProtocolTest {

    private val protocol = SocketIoProtocol()

    @Test
    fun engineFramesAreDecoded() {
        val open = protocol.decode("""0{"sid":"abc","pingInterval":25000,"pingTimeout":20000}""")
        assertEquals(EngineIoPacket.Open(25_000, 20_000), open)
        assertEquals(EngineIoPacket.Open(null, null), protocol.decode("0"))
        assertEquals(EngineIoPacket.Ping, protocol.decode("2"))
        assertEquals(EngineIoPacket.Pong, protocol.decode("3"))
        assertEquals(EngineIoPacket.Close, protocol.decode("1"))
        assertEquals(EngineIoPacket.Unknown("x"), protocol.decode("x"))
        assertEquals("3", protocol.encodePong())
    }

    @Test
    fun namespaceConnectCarriesTheToken() {
        assertEquals("""40/app,{"token":"t1"}""", protocol.encodeConnect("/app", "t1"))
        assertEquals("""40{"token":"t1"}""", protocol.encodeConnect("/", "t1"))
        val payload = buildJsonObject { put("a", JsonPrimitive(1)) }
        assertEquals("""42/app,["ping",{"a":1}]""", protocol.encodeEvent("/app", "ping", payload))
    }

    @Test
    fun socketPacketsAreDecodedWithNamespaceAndPayload() {
        assertEquals(SocketIoPacket.Connected("/app"), socket("""40/app,{"sid":"s"}"""))
        assertEquals(SocketIoPacket.Disconnect("/app"), socket("41/app,"))
        val event = socket("""42/app,7["entity.updated",{"id":"b1"}]""")
        assertIs<SocketIoPacket.Event>(event)
        assertEquals("entity.updated", event.name)
        assertEquals("b1", event.payload.jsonObject["id"]?.jsonPrimitive?.content)
        val error = socket("""44/app,{"message":"UNAUTHORIZED","data":{"code":"UNAUTHORIZED"}}""")
        assertEquals(SocketIoPacket.ConnectError("/app", "UNAUTHORIZED"), error)
        assertEquals(SocketIoPacket.ConnectError("/", "boom"), socket("""44{"message":"boom"}"""))
        assertIs<SocketIoPacket.Unknown>(socket("42/app,not-json"))
    }

    /** Frames observed on the local real stack: book → `entity.updated` summary + `notifications.unread`. */
    @Test
    fun realServerFramesDecodeToTheEventsTheScreensUse() {
        val order = socket(
            """42/app,["entity.updated",{"id":"6ade3cfcc2cfb0cb993a1726","referenceNumber":"WAB-Z4JSMB","status":"PENDING",""" +
                """"paymentStatus":"PAY_ON_ARRIVAL","appointmentStart":"2026-10-30T08:00:00.000Z",""" +
                """"appointmentEnd":"2026-10-30T09:00:00.000Z","respondBy":"2026-10-30T09:00:00.000Z",""" +
                """"total":"49.000","personsCount":1}]""",
        )
        assertIs<SocketIoPacket.Event>(order)
        assertEquals(RealtimeEvents.ENTITY_UPDATED, order.name)
        assertEquals("6ade3cfcc2cfb0cb993a1726", RealtimeEvent(order.name, order.payload).entityId())
        val unread = socket("""42/app,["notifications.unread",{"count":2}]""")
        assertIs<SocketIoPacket.Event>(unread)
        assertEquals(RealtimeEvents.NOTIFICATIONS_UNREAD, unread.name)
        assertEquals("2", unread.payload.jsonObject["count"]?.jsonPrimitive?.content)
    }

    private fun socket(frame: String): SocketIoPacket = (protocol.decode(frame) as EngineIoPacket.Message).packet
}
