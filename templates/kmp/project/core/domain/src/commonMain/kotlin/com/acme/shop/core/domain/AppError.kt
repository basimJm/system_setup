package com.acme.shop.core.domain

/** A field-level detail of a VALIDATION_ERROR envelope (`error.details[]`). */
data class FieldError(val field: String, val code: String, val message: String)

sealed interface AppError {
    /** The backend answered with its error envelope: branch on [code], never on [message]. */
    data class ServerError(
        val code: ErrorCode,
        val statusCode: Int,
        val message: String?,
        val details: List<FieldError> = emptyList(),
        val traceId: String? = null,
    ) : AppError

    /** A non-envelope HTTP failure (proxy page, empty body). */
    data class HttpError(val statusCode: Int, val message: String?) : AppError
    data class ParseError(val message: String?) : AppError
    data class NetworkError(val errorMsg: String) : AppError
    data class UnknownError(val errorMsg: String) : AppError
}
