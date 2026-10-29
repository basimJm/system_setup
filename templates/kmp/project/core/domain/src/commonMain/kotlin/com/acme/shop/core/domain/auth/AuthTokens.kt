package com.acme.shop.core.domain.auth

/** The pair the backend issues at login and rotates on every refresh. */
data class AuthTokens(
    val accessToken: String,
    val refreshToken: String,
)
