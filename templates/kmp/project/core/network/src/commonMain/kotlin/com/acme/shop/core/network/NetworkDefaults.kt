package com.acme.shop.core.network

/** Timeouts and retry policy of the HTTP client (CLAUDE.md §1.2: no magic numbers at the call sites). */
object NetworkDefaults {
    const val CONNECT_TIMEOUT_MS = 10_000L
    const val REQUEST_TIMEOUT_MS = 30_000L
    const val SOCKET_TIMEOUT_MS = 30_000L

    /** Idempotent requests (GET) are retried on transport failures and 5xx answers with exponential backoff. */
    const val MAX_RETRIES = 2
    const val RETRY_BASE_DELAY_MS = 500L
    const val RETRY_MAX_DELAY_MS = 4_000L
    const val SERVER_ERROR_RANGE_START = 500

    /** Error text is capped before it reaches logs or a fallback message. */
    const val MAX_ERROR_MESSAGE_LENGTH = 500
}
