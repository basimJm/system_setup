package com.acme.shop.core.domain

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

/**
 * Language and theme choices, persisted locally and applied immediately (Customer , §3.2).
 * Defaults are Arabic and System; stored values that are unknown fall back to those defaults.
 */
class AppearanceSettings(private val appSettings: AppSettings) {
    val language: Flow<AppLanguage> = appSettings.language.map(AppLanguage::fromCode)
    val themeMode: Flow<ThemeMode> = appSettings.themeMode

    suspend fun setLanguage(language: AppLanguage) = appSettings.setLanguage(language.code)

    suspend fun setThemeMode(mode: ThemeMode) = appSettings.setThemeMode(mode)

    /** Flips Arabic <-> English and returns the language now in effect. */
    suspend fun toggleLanguage(): AppLanguage {
        val next = language.first().other
        setLanguage(next)
        return next
    }
}
