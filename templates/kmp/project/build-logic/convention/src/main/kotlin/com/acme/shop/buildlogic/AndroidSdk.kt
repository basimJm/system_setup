package com.acme.shop.buildlogic

/**
 * The single place for Android SDK levels and the namespace root (CLAUDE.md §1.2: no magic numbers in build files).
 * Every convention plugin reads these; module build files never repeat them.
 */
internal object AndroidSdk {
    const val COMPILE_SDK = 36
    const val TARGET_SDK = 36
    const val MIN_SDK = 26
    const val NAMESPACE_ROOT = "com.acme.shop"

    /** Build flavor dimension: one flavor per environment (CLAUDE.md §5). */
    const val ENVIRONMENT_DIMENSION = "environment"

    /** The flavor the `:baselineprofile` module profiles (dev and prod run the same code). */
    const val PROFILE_ENVIRONMENT = "dev"

    /** the app the `:baselineprofile` module profiles, and the lowest API that can collect a profile. */
    const val APP_PROJECT_PATH = ":androidApp"
    const val BASELINE_PROFILE_PROJECT_PATH = ":baselineprofile"
    const val BASELINE_PROFILE_MIN_SDK = 28
}

/** `:core:design-system` -> `com.acme.shop.core.designsystem` (Android namespaces allow no dashes). */
internal fun namespaceFor(projectPath: String): String =
    AndroidSdk.NAMESPACE_ROOT + projectPath
        .split(":")
        .filter { it.isNotEmpty() }
        .joinToString(separator = "", prefix = ".", postfix = "") { segment -> segment.replace("-", "") }
        .let { if (it == ".") "" else it }
