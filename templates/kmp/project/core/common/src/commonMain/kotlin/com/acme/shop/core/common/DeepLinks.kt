package com.acme.shop.core.common

/** A link the app can open: the path segments after the web origin (`https://<host>/items/42` → `[items, 42]`). */
data class DeepLink(val segments: List<String>) {
    val first: String? get() = segments.firstOrNull()
}

/** Shareable links of the app's website (`AppEnvironment.webBaseUrl`) and the parser for opened links. */
object DeepLinks {
    private const val SEPARATOR = '/'
    private const val SCHEME_SEPARATOR = "://"
    private const val QUERY = '?'
    private const val FRAGMENT = '#'

    /** `of("https://x.app/", "items", " 42 ")` → `https://x.app/items/42`. */
    fun of(webBaseUrl: String, vararg segments: String): String =
        webBaseUrl.trimEnd(SEPARATOR) + segments.joinToString("") { "$SEPARATOR${it.trim().trim(SEPARATOR)}" }

    /** Website host of [webBaseUrl] (`dev.example.app`): the App Links / Universal Links domain. */
    fun host(webBaseUrl: String): String = webBaseUrl.substringAfter(SCHEME_SEPARATOR).substringBefore(SEPARATOR).trim()

    /**
     * Parses an opened URL into its path segments; null for a link without a path or from another host. The host is
     * compared case-insensitively; a null [webBaseUrl] accepts any host (the OS already verified the association).
     */
    fun parse(url: String, webBaseUrl: String? = null): DeepLink? {
        val trimmed = url.trim().substringBefore(QUERY).substringBefore(FRAGMENT)
        val afterScheme = trimmed.substringAfter(SCHEME_SEPARATOR, missingDelimiterValue = "")
        if (afterScheme.isEmpty()) return null
        val host = afterScheme.substringBefore(SEPARATOR)
        if (webBaseUrl != null && !host.equals(host(webBaseUrl), ignoreCase = true)) return null
        val segments = afterScheme.substringAfter(SEPARATOR, missingDelimiterValue = "").split(SEPARATOR).filter { it.isNotBlank() }
        return segments.takeIf { it.isNotEmpty() }?.let(::DeepLink)
    }
}
