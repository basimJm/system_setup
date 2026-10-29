package com.acme.shop.core.security

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class SecurePayloadTest {

    @Test
    fun packAndUnpackRoundTrip() {
        val payload = SecurePayload(iv = byteArrayOf(1, 2, 3), cipherText = byteArrayOf(9, 8, 7, 6))
        assertEquals(payload, SecurePayload.unpack(payload.pack()))
    }

    @Test
    fun malformedPayloadsAreDropped() {
        assertNull(SecurePayload.unpack("no-separator"))
        assertNull(SecurePayload.unpack(":AAAA"))
        assertNull(SecurePayload.unpack("AAAA:"))
        assertNull(SecurePayload.unpack("@@@:AAAA"))
    }
}
