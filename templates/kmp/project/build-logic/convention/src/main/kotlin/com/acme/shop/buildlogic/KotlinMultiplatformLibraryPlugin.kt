package com.acme.shop.buildlogic

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.apply
import org.gradle.kotlin.dsl.configure
import org.jetbrains.kotlin.gradle.dsl.KotlinMultiplatformExtension

class KotlinMultiplatformLibraryPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            apply(plugin = "org.jetbrains.kotlin.multiplatform")
            apply(plugin = "com.android.kotlin.multiplatform.library")

            val frameworkName = path
                .split(":")
                .filter { it.isNotEmpty() }
                .joinToString("") { it.replaceFirstChar { c -> c.uppercase() } }

            extensions.configure<KotlinMultiplatformExtension> {
                jvmToolchain(21)
                configureKotlinMultiplatform(this, frameworkName)
            }

            // Android-specific config (namespace, compileSdk, minSdk) is configured
            // per-module in build.gradle.kts via: kotlin { android { ... } }
        }
    }
}
