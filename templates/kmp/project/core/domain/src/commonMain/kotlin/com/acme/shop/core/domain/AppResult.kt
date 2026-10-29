package com.acme.shop.core.domain

sealed interface AppResult<out T> {
    data class Success<T>(val data: T) : AppResult<T>
    data class Error(val appError: AppError) : AppResult<Nothing>
    data object Loading : AppResult<Nothing>
}

fun <T, R> AppResult<T>.mapSuccess(transform: (T) -> R): AppResult<R> = when (this) {
    is AppResult.Success -> AppResult.Success(transform(data))
    is AppResult.Error -> AppResult.Error(appError)
    is AppResult.Loading -> AppResult.Loading
}
