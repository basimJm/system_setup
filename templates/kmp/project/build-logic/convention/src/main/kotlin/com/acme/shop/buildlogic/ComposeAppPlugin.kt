package com.acme.shop.buildlogic

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.apply
import org.gradle.kotlin.dsl.configure
import org.jetbrains.kotlin.gradle.dsl.KotlinMultiplatformExtension

/**
 * Kotlin/Native binary options of the iOS framework.
 * - `bundleId`: the framework's bundle id (silences the K/N warning and names the framework in crash reports).
 * - `gc = cms`: concurrent marking, so the mark phase no longer pauses the main thread (fewer dropped frames while
 *   scrolling lists that allocate, e.g. image-heavy cards).
 * - `appStateTracking = enabled`: the GC stops its timer-driven collections while the app is in the background.
 */
private const val BINARY_OPTION_BUNDLE_ID = "bundleId"
private const val BINARY_OPTION_GC = "gc"
private const val GC_CONCURRENT_MARK_SWEEP = "cms"
private const val BINARY_OPTION_APP_STATE_TRACKING = "appStateTracking"
private const val APP_STATE_TRACKING_ENABLED = "enabled"

class ComposeAppPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            apply(plugin = "org.jetbrains.kotlin.multiplatform")
            apply(plugin = "com.android.kotlin.multiplatform.library")
            apply(plugin = "org.jetbrains.compose")
            apply(plugin = "org.jetbrains.kotlin.plugin.compose")
            apply(plugin = "org.jetbrains.kotlin.plugin.serialization")

            extensions.configure<KotlinMultiplatformExtension> {
                jvmToolchain(21)
                configureKotlinQuality(this)

                listOf(iosArm64(), iosSimulatorArm64()).forEach { iosTarget ->
                    iosTarget.binaries.all {
                        binaryOption(BINARY_OPTION_BUNDLE_ID, AndroidSdk.NAMESPACE_ROOT)
                        binaryOption(BINARY_OPTION_GC, GC_CONCURRENT_MARK_SWEEP)
                        binaryOption(BINARY_OPTION_APP_STATE_TRACKING, APP_STATE_TRACKING_ENABLED)
                    }
                    iosTarget.binaries.framework {
                        baseName = "ComposeApp"
                        isStatic = true
                        // Swift implements the Firebase bridges, so their Kotlin interfaces must be in the framework API.
                        export(project(":core:firebase"))
                    }
                }

                sourceSets.commonMain.dependencies {
                    implementation(project(":core:common"))
                    implementation(project(":core:di"))
                    implementation(project(":core:domain"))
                    implementation(project(":core:storage"))
                    implementation(project(":core:network"))
                    implementation(project(":core:realtime"))
                    implementation(project(":core:data"))
                    implementation(project(":core:navigation"))
                    implementation(project(":core:ui"))
                    implementation(project(":core:mvi"))
                    implementation(project(":core:analytics"))
                    api(project(":core:firebase"))
                    implementation(project(":core:notification"))
                    implementation(project(":core:security"))
                    implementation(project(":core:design-system"))

                    FEATURE_MODULES.forEach { implementation(project(it)) }

                    implementation(libs.findBundle("compose").get())
                    implementation(libs.findLibrary("compose-uiToolingPreview").get())
                    implementation(libs.findLibrary("jetbrains-navigation-compose").get())
                    implementation(libs.findBundle("ktor").get())
                    implementation(libs.findBundle("koin").get())
                    implementation(libs.findBundle("coroutines").get())
                    implementation(libs.findLibrary("kotlinx-serialization-json").get())
                }

                sourceSets.androidMain.dependencies {
                    implementation(libs.findBundle("ktor-android").get())
                    implementation(libs.findBundle("coroutines-android").get())
                    implementation(libs.findBundle("koin-android").get())
                    implementation(libs.findBundle("lifecycle").get())
                }

                sourceSets.iosMain.dependencies {
                    implementation(libs.findBundle("ktor-ios").get())
                }

                sourceSets.commonTest.dependencies {
                    implementation(libs.findLibrary("kotlin-test").get())
                    implementation(libs.findLibrary("kotlinx-coroutines-test").get())
                }
            }

            // Android-specific config (namespace, compileSdk, minSdk) is in
            // composeApp/build.gradle.kts via: kotlin { android { ... } }
        }
    }
}

/** Feature modules compiled into the app shell (add a feature here, in `settings.gradle.kts` and in `App.kt`). */
private val FEATURE_MODULES = listOf(
    ":feature:sample:presentation",
    ":feature:sample:data",
    ":feature:sample:domain",
    ":feature:sample:di",
)
