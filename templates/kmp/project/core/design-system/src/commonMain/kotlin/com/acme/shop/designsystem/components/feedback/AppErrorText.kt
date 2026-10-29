package com.acme.shop.designsystem.components.feedback

import androidx.compose.runtime.Composable
import com.acme.shop.core.domain.AppError
import com.acme.shop.core.domain.ErrorCode
import com.acme.shop.designsystem.resources.Res
import com.acme.shop.designsystem.resources.error_code_validation_error
import com.acme.shop.designsystem.resources.error_code_unauthorized
import com.acme.shop.designsystem.resources.error_code_forbidden
import com.acme.shop.designsystem.resources.error_code_permission_denied
import com.acme.shop.designsystem.resources.error_code_not_found
import com.acme.shop.designsystem.resources.error_code_conflict
import com.acme.shop.designsystem.resources.error_code_rate_limited
import com.acme.shop.designsystem.resources.error_code_internal
import com.acme.shop.designsystem.resources.error_code_otp_blocked
import com.acme.shop.designsystem.resources.error_code_otp_invalid
import com.acme.shop.designsystem.resources.error_code_otp_expired
import com.acme.shop.designsystem.resources.error_code_phone_not_registered
import com.acme.shop.designsystem.resources.error_code_phone_already_registered
import com.acme.shop.designsystem.resources.error_code_account_blocked
import com.acme.shop.designsystem.resources.error_code_upload_invalid
import com.acme.shop.designsystem.resources.error_code_upload_too_large
import com.acme.shop.designsystem.resources.error_code_maintenance
import com.acme.shop.designsystem.resources.error_code_update_required
import com.acme.shop.designsystem.resources.error_code_current_password_invalid
import com.acme.shop.designsystem.resources.error_code_email_already_used
import com.acme.shop.designsystem.resources.error_code_unknown
import com.acme.shop.designsystem.resources.state_error_message
import com.acme.shop.designsystem.resources.state_offline_message
import org.jetbrains.compose.resources.StringResource
import org.jetbrains.compose.resources.getString
import org.jetbrains.compose.resources.stringResource

/** One localized string per server error code; `ErrorTextTest` proves the table covers every [ErrorCode]. */
internal val ERROR_CODE_STRINGS: Map<ErrorCode, StringResource> = mapOf(
    ErrorCode.VALIDATION_ERROR to Res.string.error_code_validation_error,
    ErrorCode.UNAUTHORIZED to Res.string.error_code_unauthorized,
    ErrorCode.FORBIDDEN to Res.string.error_code_forbidden,
    ErrorCode.PERMISSION_DENIED to Res.string.error_code_permission_denied,
    ErrorCode.NOT_FOUND to Res.string.error_code_not_found,
    ErrorCode.CONFLICT to Res.string.error_code_conflict,
    ErrorCode.RATE_LIMITED to Res.string.error_code_rate_limited,
    ErrorCode.INTERNAL to Res.string.error_code_internal,
    ErrorCode.OTP_BLOCKED to Res.string.error_code_otp_blocked,
    ErrorCode.OTP_INVALID to Res.string.error_code_otp_invalid,
    ErrorCode.OTP_EXPIRED to Res.string.error_code_otp_expired,
    ErrorCode.PHONE_NOT_REGISTERED to Res.string.error_code_phone_not_registered,
    ErrorCode.PHONE_ALREADY_REGISTERED to Res.string.error_code_phone_already_registered,
    ErrorCode.ACCOUNT_BLOCKED to Res.string.error_code_account_blocked,
    ErrorCode.UPLOAD_INVALID to Res.string.error_code_upload_invalid,
    ErrorCode.UPLOAD_TOO_LARGE to Res.string.error_code_upload_too_large,
    ErrorCode.MAINTENANCE to Res.string.error_code_maintenance,
    ErrorCode.UPDATE_REQUIRED to Res.string.error_code_update_required,
    ErrorCode.CURRENT_PASSWORD_INVALID to Res.string.error_code_current_password_invalid,
    ErrorCode.EMAIL_ALREADY_USED to Res.string.error_code_email_already_used,
    ErrorCode.UNKNOWN to Res.string.error_code_unknown,
)

fun errorCodeResource(code: ErrorCode): StringResource = ERROR_CODE_STRINGS[code] ?: ERROR_CODE_STRINGS.getValue(ErrorCode.UNKNOWN)

/**
 * The text a user sees for any [AppError] (CLAUDE.md §3: never raw server text). Server errors use their code's
 * string; connectivity problems the offline text; parse and unknown errors the generic one.
 */
fun errorResource(error: AppError): StringResource = when (error) {
    is AppError.ServerError -> errorCodeResource(error.code)
    is AppError.NetworkError -> Res.string.state_offline_message
    is AppError.HttpError, is AppError.ParseError, is AppError.UnknownError -> Res.string.state_error_message
}

@Composable
fun appErrorMessage(error: AppError): String = stringResource(errorResource(error))

/** For ViewModels (no composition): the same mapping through the suspending resource loader. */
suspend fun appErrorText(error: AppError): String = getString(errorResource(error))
