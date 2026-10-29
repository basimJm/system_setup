package com.acme.shop.core.domain

import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals

class AppearanceSettingsTest {
    @Test
    fun freshInstallIsArabicAndFollowsTheSystemTheme() = runTest {
        val appearance = AppearanceSettings(FakeAppSettings())

        assertEquals(AppLanguage.ARABIC, appearance.language.first())
        assertEquals(ThemeMode.SYSTEM, appearance.themeMode.first())
    }

    @Test
    fun chosenLanguageIsPersistedAsItsCode() = runTest {
        val settings = FakeAppSettings()

        AppearanceSettings(settings).setLanguage(AppLanguage.ENGLISH)

        assertEquals("en", settings.language.first())
    }

    @Test
    fun toggleSwitchesBackAndForthAndReturnsTheLanguageNowInEffect() = runTest {
        val appearance = AppearanceSettings(FakeAppSettings())

        assertEquals(AppLanguage.ENGLISH, appearance.toggleLanguage())
        assertEquals(AppLanguage.ENGLISH, appearance.language.first())
        assertEquals(AppLanguage.ARABIC, appearance.toggleLanguage())
        assertEquals(AppLanguage.ARABIC, appearance.language.first())
    }

    @Test
    fun aCorruptStoredLanguageFallsBackToArabic() = runTest {
        val appearance = AppearanceSettings(FakeAppSettings(storedLanguage = "klingon"))

        assertEquals(AppLanguage.ARABIC, appearance.language.first())
    }

    @Test
    fun aDeviceLocaleTagStoredByAnOlderBuildStillResolves() = runTest {
        val appearance = AppearanceSettings(FakeAppSettings(storedLanguage = "en_US"))

        assertEquals(AppLanguage.ENGLISH, appearance.language.first())
    }

    @Test
    fun everyThemeModeCanBeChosen() = runTest {
        val appearance = AppearanceSettings(FakeAppSettings())

        ThemeMode.entries.forEach { mode ->
            appearance.setThemeMode(mode)
            assertEquals(mode, appearance.themeMode.first())
        }
    }

    @Test
    fun unknownStoredThemeNameMeansSystem() {
        assertEquals(ThemeMode.SYSTEM, ThemeMode.fromString("sepia"))
        assertEquals(ThemeMode.DARK, ThemeMode.fromString("dark"))
    }
}
