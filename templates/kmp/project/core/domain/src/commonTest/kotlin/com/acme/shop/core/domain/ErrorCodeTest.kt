package com.acme.shop.core.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ErrorCodeTest {

    @Test
    fun knownCodesParseAndUnknownOnesFallBack() {
        assertEquals(ErrorCode.CONFLICT, ErrorCode.fromServer("CONFLICT"))
        assertEquals(ErrorCode.UNKNOWN, ErrorCode.fromServer("NOT_A_CODE"))
        assertEquals(ErrorCode.UNKNOWN, ErrorCode.fromServer(null))
        assertEquals(ErrorCode.UNKNOWN, ErrorCode.fromServer("conflict"))
    }

    @Test
    fun everyBusinessDomainCodeIsPresent() {
        val expected = listOf(
            "VALIDATION_ERROR", "UNAUTHORIZED", "FORBIDDEN", "PERMISSION_DENIED", "NOT_FOUND", "CONFLICT", "RATE_LIMITED", "INTERNAL",
            "OTP_BLOCKED", "OTP_INVALID", "OTP_EXPIRED", "PHONE_NOT_REGISTERED", "PHONE_ALREADY_REGISTERED",
            "ACCOUNT_BLOCKED",
            "UPLOAD_INVALID", "UPLOAD_TOO_LARGE", "MAINTENANCE", "UPDATE_REQUIRED", "CURRENT_PASSWORD_INVALID", "EMAIL_ALREADY_USED",
            )
        val names = ErrorCode.entries.map { it.name }
        expected.forEach { assertTrue(it in names, "missing $it") }
        assertEquals(expected.size + 1, ErrorCode.entries.size)
    }
}
