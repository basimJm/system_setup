package com.acme.shop.buildlogic

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.apply
import org.gradle.kotlin.dsl.configure
import org.jetbrains.kotlin.gradle.dsl.KotlinMultiplatformExtension

/**
 * Convention for a core library that exposes composables: everything in [KmpCoreLibraryPlugin] plus the Compose
 * Multiplatform and Compose compiler plugins, the lean Compose runtime/foundation pair, the lifecycle bundle and the
 * Android tooling preview. Modules that need Material, Coil or paging add those themselves.
 */
class KmpCoreComposePlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            apply(plugin = "com.acme.shop.core.library")
            apply(plugin = "org.jetbrains.compose")
            apply(plugin = "org.jetbrains.kotlin.plugin.compose")
            extensions.configure<KotlinMultiplatformExtension> {
                sourceSets.commonMain.dependencies {
                    implementation(libs.findLibrary("compose-runtime").get())
                    implementation(libs.findLibrary("compose-foundation").get())
                    implementation(libs.findBundle("lifecycle").get())
                }
                sourceSets.androidMain.dependencies {
                    implementation(libs.findLibrary("compose-uiToolingPreview").get())
                }
            }
        }
    }
}
