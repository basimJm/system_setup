package com.acme.shop.buildlogic

import com.android.build.api.dsl.KotlinMultiplatformAndroidLibraryTarget
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.plugins.ExtensionAware
import org.gradle.kotlin.dsl.apply
import org.gradle.kotlin.dsl.configure
import org.jetbrains.kotlin.gradle.dsl.KotlinMultiplatformExtension

private const val ANDROID_TARGET_EXTENSION = "android"

/**
 * Convention for a core Kotlin Multiplatform library without Compose:
 * the shared KMP library setup, an Android target whose namespace follows the module path and whose SDK levels
 * come from [AndroidSdk], coroutines in `commonMain`, and the coroutine test library in `commonTest`.
 * A module applies it with `alias(libs.plugins.com.acme.shop.core.library)` and adds only its own dependencies.
 */
class KmpCoreLibraryPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            apply(plugin = "com.acme.shop.kotlin.multiplatform.library")
            extensions.configure<KotlinMultiplatformExtension> {
                configureCoreAndroidTarget(this)
                sourceSets.commonMain.dependencies {
                    implementation(libs.findBundle("coroutines").get())
                }
                sourceSets.commonTest.dependencies {
                    implementation(libs.findLibrary("kotlinx-coroutines-test").get())
                }
            }
        }
    }
}

/** Android target settings shared by every core module: namespace from the path, SDK levels from [AndroidSdk]. */
internal fun Project.configureCoreAndroidTarget(extension: KotlinMultiplatformExtension) {
    (extension as ExtensionAware).extensions.configure<KotlinMultiplatformAndroidLibraryTarget>(ANDROID_TARGET_EXTENSION) {
        namespace = namespaceFor(path)
        compileSdk = AndroidSdk.COMPILE_SDK
        minSdk = AndroidSdk.MIN_SDK
        androidResources { enable = true }
    }
}
