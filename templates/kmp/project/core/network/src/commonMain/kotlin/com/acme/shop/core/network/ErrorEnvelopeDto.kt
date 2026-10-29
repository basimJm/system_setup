package com.acme.shop.core.network

import com.acme.shop.core.domain.AppError
import com.acme.shop.core.domain.ErrorCode
import com.acme.shop.core.domain.FieldError
import kotlinx.serialization.Serializable

/**
 * The backend error envelope (`WAB-Server/CLAUDE.md` §6):
 * `{ "success": false, "message": "<localized>", "error": { "code", "details": [ { field, code, message } ], "traceId" } }`.
 */
@Serializable
data class ErrorEnvelopeDto(
    val success: Boolean = false,
    val message: String? = null,
    val error: ErrorBodyDto? = null,
)

@Serializable
data class ErrorBodyDto(
    val code: String? = null,
    val details: List<ErrorDetailDto>? = null,
    val traceId: String? = null,
)

@Serializable
data class ErrorDetailDto(
    val field: String = "",
    val code: String = "",
    val message: String = "",
)

/** An envelope is only trusted when it carries a code; anything else stays a plain HTTP error. */
fun ErrorEnvelopeDto.toServerError(statusCode: Int): AppError.ServerError? {
    val body = error ?: return null
    val code = body.code?.takeIf { it.isNotBlank() } ?: return null
    return AppError.ServerError(
        code = ErrorCode.fromServer(code),
        statusCode = statusCode,
        message = message,
        details = body.details.orEmpty().map { FieldError(it.field, it.code, it.message) },
        traceId = body.traceId,
    )
}
