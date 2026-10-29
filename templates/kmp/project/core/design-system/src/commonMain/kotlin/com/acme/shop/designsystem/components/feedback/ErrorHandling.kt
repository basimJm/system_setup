package com.acme.shop.designsystem.components.feedback

import com.acme.shop.core.domain.AppError
import com.acme.shop.core.domain.ErrorCode
import com.acme.shop.designsystem.resources.Res
import com.acme.shop.designsystem.resources.state_action_contact
import com.acme.shop.designsystem.resources.state_action_login
import com.acme.shop.designsystem.resources.state_action_update
import com.acme.shop.designsystem.resources.state_retry
import org.jetbrains.compose.resources.StringResource

/** What the user can do about an error: retry the request, sign in, contact support, update, or go back. */
enum class ErrorAction { RETRY, LOGIN, CONTACT, UPDATE, DISMISS }

/** The handling path of every server code; the policy check `error-codes` keeps this exhaustive. */
fun errorActionOf(code: ErrorCode): ErrorAction = when (code) {
    in LOGIN_CODES -> ErrorAction.LOGIN
    in CONTACT_CODES -> ErrorAction.CONTACT
    ErrorCode.UPDATE_REQUIRED -> ErrorAction.UPDATE
    in RETRY_CODES -> ErrorAction.RETRY
    else -> ErrorAction.DISMISS
}

private val LOGIN_CODES = setOf(
    ErrorCode.UNAUTHORIZED, ErrorCode.ACCOUNT_BLOCKED, ErrorCode.PHONE_NOT_REGISTERED,
)
private val CONTACT_CODES = setOf(
    ErrorCode.FORBIDDEN, ErrorCode.PERMISSION_DENIED, ErrorCode.INTERNAL, ErrorCode.UNKNOWN,
)
private val RETRY_CODES = setOf(
    ErrorCode.RATE_LIMITED, ErrorCode.MAINTENANCE, ErrorCode.NOT_FOUND, ErrorCode.CONFLICT,
    ErrorCode.OTP_EXPIRED, ErrorCode.UPLOAD_INVALID, ErrorCode.UPLOAD_TOO_LARGE,
)

/** Business-rule codes whose message is the whole handling (no button). Listed so the policy check sees every code. */
private val DISMISS_CODES = setOf(
    ErrorCode.VALIDATION_ERROR, ErrorCode.OTP_BLOCKED, ErrorCode.OTP_INVALID, ErrorCode.PHONE_ALREADY_REGISTERED,
    ErrorCode.CURRENT_PASSWORD_INVALID, ErrorCode.EMAIL_ALREADY_USED,
)

/** All codes are classified exactly once (checked by `ErrorTextTest`). */
internal val CLASSIFIED_CODES: Set<ErrorCode> = LOGIN_CODES + CONTACT_CODES + setOf(ErrorCode.UPDATE_REQUIRED) + RETRY_CODES + DISMISS_CODES

/** Connectivity and transport failures are always retried; server errors follow their code. */
fun errorActionOf(error: AppError): ErrorAction = when (error) {
    is AppError.ServerError -> errorActionOf(error.code)
    is AppError.NetworkError, is AppError.HttpError, is AppError.ParseError -> ErrorAction.RETRY
    is AppError.UnknownError -> ErrorAction.CONTACT
}

/** Button label of an action; null for [ErrorAction.DISMISS] (the message alone is the handling). */
fun errorActionLabel(action: ErrorAction): StringResource? = when (action) {
    ErrorAction.RETRY -> Res.string.state_retry
    ErrorAction.LOGIN -> Res.string.state_action_login
    ErrorAction.CONTACT -> Res.string.state_action_contact
    ErrorAction.UPDATE -> Res.string.state_action_update
    ErrorAction.DISMISS -> null
}
