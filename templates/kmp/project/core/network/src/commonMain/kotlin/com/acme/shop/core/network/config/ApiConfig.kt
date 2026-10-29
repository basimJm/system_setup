package com.acme.shop.core.network.config

import com.acme.shop.core.network.NetworkDefaults

data class ApiConfig(
    val baseUrl: String,
    val authToken: String? = null,
    val connectTimeout: Long = NetworkDefaults.CONNECT_TIMEOUT_MS,
    val receiveTimeout: Long = NetworkDefaults.SOCKET_TIMEOUT_MS,
    val sendTimeout: Long = NetworkDefaults.REQUEST_TIMEOUT_MS,
    val isDebug: Boolean = false,
) {
    val useAuth: Boolean get() = !authToken.isNullOrBlank()
}
