package com.acme.shop.core.network

import com.acme.shop.core.domain.AppError
import com.acme.shop.core.domain.AppResult
import io.ktor.client.call.body
import io.ktor.client.plugins.HttpRequestTimeoutException
import io.ktor.client.plugins.ResponseException
import io.ktor.serialization.ContentConvertException
import kotlinx.coroutines.CancellationException
import kotlinx.io.IOException
import kotlinx.serialization.SerializationException

/**
 * Turns any API call into an [AppResult]: the backend envelope becomes [AppError.ServerError] (code-driven),
 * other HTTP failures [AppError.HttpError], transport problems [AppError.NetworkError]. Never throws except for
 * cancellation, never logs bodies (they can carry personal data).
 */
suspend fun <T> safeApiCall(block: suspend () -> T): AppResult<T> = try {
    AppResult.Success(block())
} catch (e: CancellationException) {
    throw e
} catch (e: ResponseException) {
    AppResult.Error(e.toAppError())
} catch (e: SerializationException) {
    AppResult.Error(AppError.ParseError(e.message?.take(NetworkDefaults.MAX_ERROR_MESSAGE_LENGTH)))
} catch (e: ContentConvertException) {
    // Ktor wraps body decoding failures (JsonConvertException) outside SerializationException: a response that
    // does not match the contract (e.g. a server older than the app) must become an error, never a crash.
    AppResult.Error(AppError.ParseError(e.message?.take(NetworkDefaults.MAX_ERROR_MESSAGE_LENGTH)))
} catch (e: HttpRequestTimeoutException) {
    AppResult.Error(AppError.NetworkError(e.message.orEmpty().take(NetworkDefaults.MAX_ERROR_MESSAGE_LENGTH)))
} catch (e: IOException) {
    AppResult.Error(AppError.NetworkError(e.message.orEmpty().take(NetworkDefaults.MAX_ERROR_MESSAGE_LENGTH)))
}

private suspend fun ResponseException.toAppError(): AppError {
    val status = response.status.value
    val envelope = runCatching { response.body<ErrorEnvelopeDto>() }.getOrNull()
    return envelope?.toServerError(status)
        ?: AppError.HttpError(statusCode = status, message = envelope?.message?.take(NetworkDefaults.MAX_ERROR_MESSAGE_LENGTH))
}
