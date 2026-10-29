package com.acme.shop.core.common

/** Where repositories get their data: mock fixtures (dev builds) or the real API. */
enum class DataSource(val configValue: String) {
    MOCK("mock"),
    REMOTE("remote"),
    ;

    companion object {
        /** Build config / Info.plist value → source; anything unknown is a configuration error, never a silent default. */
        fun fromConfig(value: String): DataSource =
            entries.firstOrNull { it.configValue.equals(value.trim(), ignoreCase = true) }
                ?: error("DATA_SOURCE must be one of ${entries.map { it.configValue }}, was '$value'")
    }
}

/**
 * Values that differ per build variant (dev/prod, debug/release).
 *
 * The platform entry point builds it from build config (Android `BuildConfig`) or from the
 * environment xcconfig through Info.plist (iOS) and registers it in Koin; shared code never
 * contains an environment value itself.
 */
data class AppEnvironment(
    val name: String,
    val apiBaseUrl: String,
    /** Public web origin: links shared from the app and opened by it (`DeepLinks`). */
    val webBaseUrl: String,
    val appVersion: String,
    val appVersionCode: Int,
    val isDebug: Boolean,
    val dataSource: DataSource = DataSource.REMOTE,
) {
    init {
        require(name.isNotBlank()) { "Environment name must not be blank" }
        require(apiBaseUrl.isNotBlank()) { "API base URL must not be blank for environment '$name'" }
        require(webBaseUrl.isNotBlank()) { "Web base URL must not be blank for environment '$name'" }
        require(appVersion.isNotBlank()) { "App version must not be blank for environment '$name'" }
        require(appVersionCode >= 0) { "App version code must not be negative" }
        require(!(isProd && dataSource == DataSource.MOCK)) { "The prod environment must use the remote data source" }
    }

    val isDev: Boolean get() = name == AppEnvironmentNames.DEV
    val isProd: Boolean get() = name == AppEnvironmentNames.PROD
    val usesMock: Boolean get() = dataSource == DataSource.MOCK
}

object AppEnvironmentNames {
    const val DEV = "dev"
    const val PROD = "prod"
}
