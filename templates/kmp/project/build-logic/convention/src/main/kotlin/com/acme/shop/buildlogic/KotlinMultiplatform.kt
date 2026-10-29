package com.acme.shop.buildlogic

import com.android.build.api.dsl.KotlinMultiplatformAndroidLibraryTarget
import org.gradle.api.Project
import org.gradle.api.plugins.ExtensionAware
import org.gradle.kotlin.dsl.configure
import org.jetbrains.kotlin.gradle.dsl.KotlinMultiplatformExtension

/** Gradle property that turns Kotlin warnings into errors (on by default; CLAUDE.md §1.7). */
private const val WARNINGS_AS_ERRORS_PROPERTY = "warningsAsErrors"
private const val ANDROID_TARGET_EXTENSION = "android"
private const val ANDROID_HOST_TEST_SOURCE_SET = "androidHostTest"
private const val EXPECT_ACTUAL_CLASSES_FLAG = "-Xexpect-actual-classes"

internal fun Project.configureKotlinMultiplatform(
    extension: KotlinMultiplatformExtension,
    frameworkName: String,
) {
    extension.apply {
        listOf(
            iosArm64(),
            iosSimulatorArm64(),
        ).forEach { iosTarget ->
            iosTarget.binaries.framework {
                baseName = frameworkName
                isStatic = true
            }
        }
    }
    configureKotlinQuality(extension)
}

/** Compiler policy and unit-test wiring shared by every Kotlin Multiplatform module. */
internal fun Project.configureKotlinQuality(extension: KotlinMultiplatformExtension) {
    extension.apply {
        compilerOptions {
            allWarningsAsErrors.set(
                providers.gradleProperty(WARNINGS_AS_ERRORS_PROPERTY).map(String::toBoolean).orElse(true),
            )
            freeCompilerArgs.add(EXPECT_ACTUAL_CLASSES_FLAG)
        }
        sourceSets.commonTest.dependencies {
            implementation(libs.findLibrary("kotlin-test").get())
        }
        // Runs commonTest on the JVM (testAndroidHostTest) next to the iOS simulator tests.
        (this as ExtensionAware).extensions.configure<KotlinMultiplatformAndroidLibraryTarget>(ANDROID_TARGET_EXTENSION) {
            withHostTest { }
        }
        sourceSets.matching { it.name == ANDROID_HOST_TEST_SOURCE_SET }.configureEach {
            dependencies { implementation(libs.findLibrary("junit").get()) }
        }
    }
}

internal val Project.libs
    get() = extensions.getByType(org.gradle.api.artifacts.VersionCatalogsExtension::class.java)
        .find("libs").get()
