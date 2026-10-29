package com.acme.shop.core.realtime

import kotlin.test.Test
import kotlin.test.assertEquals

class RealtimeConfigTest {

    @Test
    fun webSocketUrlFollowsTheApiHost() {
        assertEquals(
            "wss://api.example/socket.io/?EIO=4&transport=websocket",
            RealtimeConfig(apiBaseUrl = "https://api.example/").webSocketUrl,
        )
        assertEquals("ws://localhost:3000/socket.io/?EIO=4&transport=websocket", RealtimeConfig("http://localhost:3000").webSocketUrl)
        assertEquals("wss://api.example/socket.io/?EIO=4&transport=websocket", RealtimeConfig("https://api.example/v1/").webSocketUrl)
    }

    @Test
    fun reconnectDelayGrowsAndCaps() {
        assertEquals(1_000, reconnectDelayMs(0))
        assertEquals(2_000, reconnectDelayMs(1))
        assertEquals(4_000, reconnectDelayMs(2))
        assertEquals(30_000, reconnectDelayMs(20))
        assertEquals(1_000, reconnectDelayMs(-3))
    }
}
