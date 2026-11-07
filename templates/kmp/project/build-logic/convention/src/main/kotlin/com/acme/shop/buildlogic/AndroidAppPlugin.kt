package com.acme.shop.buildlogic

import androidx.baselineprofile.gradle.consumer.BaselineProfileConsumerExtension
import com.android.build.api.dsl.ApplicationExtension
import com.android.build.api.dsl.ApplicationProductFlavor
import org.gradle.api.JavaVersion
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.apply
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.dependencies
import java.util.Properties

private const val PROGUARD_DEFAULT_FILE = "proguard-android-optimize.txt"
private const val PROGUARD_APP_FILE = "proguard-rules.pro"
private const val PROGUARD_DATA_FILE = "data-proguard-rules.pro"
private const val LINT_CONFIG_FILE = "config/lint.xml"
private const val DEBUG_SIGNING = "debug"
private const val RELEASE_BUILD_TYPE = "release"
private const val RELEASE_SUFFIX = "Release"

class AndroidAppPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            apply(plugin = "com.android.application")
            apply(plugin = "org.jetbrains.compose")
            apply(plugin = "org.jetbrains.kotlin.plugin.compose")
            apply(plugin = "com.google.gms.google-services")
            // Generates the Crashlytics build id; without it the Crashlytics SDK aborts the app at startup.
            apply(plugin = "com.google.firebase.crashlytics")
            // Baseline + Startup Profiles, only when the producer module is part of the build (the template
            // generates projects without it).
            val profiles = rootProject.findProject(AndroidSdk.BASELINE_PROFILE_PROJECT_PATH) != null
            if (profiles) apply(plugin = "androidx.baselineprofile")

            val localProperties = Properties()
            val localPropertiesFile = rootProject.file("local.properties")
            if (localPropertiesFile.exists()) {
                localPropertiesFile.inputStream().use { localProperties.load(it) }
            }
            val mapsApiKey = localProperties.getProperty("MAPS_API_KEY") ?: ""
            val property = { name: String -> projectProperty(localProperties, name) }

            extensions.configure<ApplicationExtension> {
                namespace = AndroidSdk.NAMESPACE_ROOT
                compileSdk = AndroidSdk.COMPILE_SDK
                defaultConfig {
                    applicationId = AndroidSdk.NAMESPACE_ROOT
                    minSdk = AndroidSdk.MIN_SDK
                    targetSdk = AndroidSdk.TARGET_SDK
                    versionCode = requireNotNull(property("APP_VERSION_CODE")) { missing("APP_VERSION_CODE") }.toInt()
                    versionName = requireNotNull(property("APP_VERSION_NAME")) { missing("APP_VERSION_NAME") }

                    manifestPlaceholders["MAPS_API_KEY"] = mapsApiKey
                }
                flavorDimensions += AndroidSdk.ENVIRONMENT_DIMENSION
                productFlavors {
                    create("dev") { environment(id = "dev", prefix = "DEV", property = property) }
                    create("prod") { environment(id = "prod", prefix = "PROD", property = property) }
                }
                buildTypes {
                    getByName("debug") {
                        isMinifyEnabled = false
                    }
                    getByName("release") {
                        isMinifyEnabled = true
                        isShrinkResources = true
                        proguardFiles(
                            getDefaultProguardFile(PROGUARD_DEFAULT_FILE),
                            PROGUARD_APP_FILE,
                            rootProject.file(PROGUARD_DATA_FILE),
                        )
                    }
                }
                // The profile build types (`nonMinifiedRelease`, `benchmarkRelease`) must install on the profiling device;
                // release itself stays unsigned here (store signing is the owner's, outside the repo).
                buildTypes.configureEach {
                    if (name != RELEASE_BUILD_TYPE && name.endsWith(RELEASE_SUFFIX)) signingConfig = signingConfigs.getByName(DEBUG_SIGNING)
                }
                lint {
                    warningsAsErrors = true
                    abortOnError = true
                    checkDependencies = true
                    checkReleaseBuilds = true
                    lintConfig = rootProject.file(LINT_CONFIG_FILE)
                    htmlReport = true
                    xmlReport = true
                    sarifReport = true
                }
                packaging {
                    resources {
                        excludes += "/META-INF/{AL2.0,LGPL2.1}"
                    }
                }
                buildFeatures {
                    buildConfig = true
                }
                compileOptions {
                    sourceCompatibility = JavaVersion.VERSION_21
                    targetCompatibility = JavaVersion.VERSION_21
                }
            }

            dependencies {
                add("implementation", project(":composeApp"))
                add("implementation", project(":core:common"))
                add("implementation", project(":core:data"))
                add("implementation", project(":core:domain"))
                add("implementation", project(":core:storage"))
                add("implementation", project(":core:ui"))
                add("implementation", project(":core:mvi"))
                add("implementation", project(":core:firebase"))
                add("implementation", project(":core:notification"))
                add("implementation", libs.findLibrary("androidx-activity-compose").get())
                add("implementation", libs.findBundle("koin-android").get())
                add("implementation", libs.findBundle("lifecycle").get())
                add("implementation", libs.findLibrary("firebase-messaging").get())
                add("debugImplementation", libs.findLibrary("compose-uiTooling").get())
                add("implementation", libs.findLibrary("androidx-profileinstaller").get())
            }
            if (profiles) {
                extensions.configure<BaselineProfileConsumerExtension> {
                    // One profile for every variant (dev and prod run the same code), kept in src/main/generated.
                    mergeIntoMain = true
                    saveInSrc = true
                    // Only devRelease has a producer (the profile module profiles dev); prod uses the merged profile.
                    variants.create(AndroidSdk.PROFILE_ENVIRONMENT + RELEASE_SUFFIX) {
                        from(rootProject.project(AndroidSdk.BASELINE_PROFILE_PROJECT_PATH))
                    }
                    warnings.variantHasNoBaselineProfileDependency = false
                }
            }
        }
    }
}

/** Per-environment values come from `local.properties` (developer override) or `gradle.properties`, never from code. */
private fun Project.projectProperty(local: Properties, name: String): String? =
    local.getProperty(name)?.takeIf { it.isNotBlank() }
        ?: providers.gradleProperty(name).orNull?.takeIf { it.isNotBlank() }

private fun missing(name: String) = "Gradle property $name is required; set it in gradle.properties or local.properties"

private fun ApplicationProductFlavor.environment(id: String, prefix: String, property: (String) -> String?) {
    dimension = AndroidSdk.ENVIRONMENT_DIMENSION
    val baseUrl = requireNotNull(property("${prefix}_API_BASE_URL")) { missing("${prefix}_API_BASE_URL") }
    property("${prefix}_APPLICATION_ID_SUFFIX")?.let { applicationIdSuffix = it }
    buildConfigField("String", "ENVIRONMENT", quoted(id))
    buildConfigField("String", "API_BASE_URL", quoted(baseUrl))
    val webBaseUrl = requireNotNull(property("${prefix}_WEB_BASE_URL")) { missing("${prefix}_WEB_BASE_URL") }
    buildConfigField("String", "WEB_BASE_URL", quoted(webBaseUrl))
    manifestPlaceholders["DEEP_LINK_HOST"] = hostOf(webBaseUrl)
    val dataSource = requireNotNull(property("${prefix}_DATA_SOURCE")) { missing("${prefix}_DATA_SOURCE") }
    buildConfigField("String", "DATA_SOURCE", quoted(dataSource))
}

/** `https://dev.example.app/` → `dev.example.app` (App Links host of the manifest). */
private fun hostOf(url: String): String = url.substringAfter("://").substringBefore('/').trim()

private fun quoted(value: String) = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
