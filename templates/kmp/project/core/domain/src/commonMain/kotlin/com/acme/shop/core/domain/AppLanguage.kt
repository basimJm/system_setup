package com.acme.shop.core.domain

/** Languages the product supports (Customer ). Arabic is the default and lays out right-to-left. */
enum class AppLanguage(val code: String, val isRtl: Boolean) {
    ARABIC(code = "ar", isRtl = true),
    ENGLISH(code = "en", isRtl = false);

    /** The other language, for the single "switch language" icon on Login, Register and Profile. */
    val other: AppLanguage get() = if (this == ARABIC) ENGLISH else ARABIC

    companion object {
        val DEFAULT: AppLanguage = ARABIC

        /**
         * Accepts a stored code or a platform locale tag (`ar`, `ar_JO`, `en-US`, `EN`); anything unknown or
         * blank falls back to [DEFAULT] so a bad stored value can never leave the app without a language.
         */
        fun fromCode(code: String?): AppLanguage {
            val language = code.orEmpty().trim().split('_', '-').first()
            return entries.firstOrNull { it.code.equals(language, ignoreCase = true) } ?: DEFAULT
        }
    }
}
