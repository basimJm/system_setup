package com.acme.shop.buildlogic

import androidx.baselineprofile.gradle.producer.BaselineProfileProducerExtension
import com.android.build.api.dsl.TestExtension
import com.android.build.api.variant.TestAndroidComponentsExtension
import org.gradle.api.JavaVersion
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.apply
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.dependencies

private const val TEST_RUNNER = "androidx.test.runner.AndroidJUnitRunner"

/** Instrumentation argument the profile journey reads to know which app id (dev flavor) it drives. */
private const val TARGET_APP_ID_ARGUMENT = "targetAppId"

/**
 * the `:baselineprofile` producer module. A Macrobenchmark test module that drives the release app through the
 * main journey (`./gradlew :androidApp:generateBaselineProfile` on a connected API 33+ device or emulator) and writes
 * the Baseline + Startup Profiles into `androidApp/src/main/generated/baselineProfiles`.
 */
class BaselineProfilePlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            apply(plugin = "com.android.test")
            apply(plugin = "androidx.baselineprofile")

            extensions.configure<TestExtension> {
                namespace = namespaceFor(path)
                compileSdk = AndroidSdk.COMPILE_SDK
                defaultConfig {
                    minSdk = AndroidSdk.BASELINE_PROFILE_MIN_SDK
                    targetSdk = AndroidSdk.TARGET_SDK
                    testInstrumentationRunner = TEST_RUNNER
                }
                targetProjectPath = AndroidSdk.APP_PROJECT_PATH
                flavorDimensions += AndroidSdk.ENVIRONMENT_DIMENSION
                // Profiles are collected on the dev flavor only (local or dev backend); prod runs the same code and
                // uses the merged profile in src/main.
                productFlavors {
                    create(AndroidSdk.PROFILE_ENVIRONMENT) { dimension = AndroidSdk.ENVIRONMENT_DIMENSION }
                }
                compileOptions {
                    sourceCompatibility = JavaVersion.VERSION_21
                    targetCompatibility = JavaVersion.VERSION_21
                }
            }

            // The journey drives the tested app by its real application id (flavor suffix included).
            extensions.configure<TestAndroidComponentsExtension> {
                onVariants { variant ->
                    val loader = variant.artifacts.getBuiltArtifactsLoader()
                    variant.instrumentationRunnerArguments.put(
                        TARGET_APP_ID_ARGUMENT,
                        variant.testedApks.map { apks -> loader.load(apks)?.applicationId.orEmpty() },
                    )
                }
            }

            // No Gradle-managed device: the profile is collected on the connected emulator/device (ANDROID_SERIAL).
            extensions.configure<BaselineProfileProducerExtension> {
                useConnectedDevices = true
            }

            dependencies {
                add("implementation", libs.findLibrary("androidx-test-ext-junit").get())
                add("implementation", libs.findLibrary("androidx-test-uiautomator").get())
                add("implementation", libs.findLibrary("androidx-benchmark-macro-junit4").get())
            }
        }
    }
}
