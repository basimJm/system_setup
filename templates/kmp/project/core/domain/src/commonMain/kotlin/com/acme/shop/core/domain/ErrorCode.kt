package com.acme.shop.core.domain

/**
 * The `error.code` values of the backend envelope.
 * Clients branch on the code, never on the message; an unlisted value maps to [UNKNOWN].
 */
enum class ErrorCode {
    VALIDATION_ERROR,
    UNAUTHORIZED,
    FORBIDDEN,
    PERMISSION_DENIED,
    NOT_FOUND,
    CONFLICT,
    RATE_LIMITED,
    INTERNAL,
    OTP_BLOCKED,
    OTP_INVALID,
    OTP_EXPIRED,
    PHONE_NOT_REGISTERED,
    PHONE_ALREADY_REGISTERED,
    ACCOUNT_BLOCKED,
    UPLOAD_INVALID,
    UPLOAD_TOO_LARGE,
    MAINTENANCE,
    UPDATE_REQUIRED,
    CURRENT_PASSWORD_INVALID,
    EMAIL_ALREADY_USED,
    UNKNOWN,
    ;

    companion object {
        fun fromServer(code: String?): ErrorCode = entries.firstOrNull { it.name == code } ?: UNKNOWN
    }
}
