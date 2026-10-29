package com.acme.shop.buildlogic

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.apply
import org.gradle.kotlin.dsl.configure
import org.jetbrains.kotlin.gradle.dsl.KotlinMultiplatformExtension

class KmpFeatureDataPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            apply(plugin = "com.acme.shop.kotlin.multiplatform.library")
            apply(plugin = "org.jetbrains.kotlin.plugin.serialization")

            extensions.configure<KotlinMultiplatformExtension> {
                sourceSets.commonMain.dependencies {
                    implementation(libs.findBundle("coroutines").get())
                    implementation(libs.findBundle("network").get())
                    implementation(libs.findLibrary("koin-core").get())
                    implementation(project(":core:domain"))
                    implementation(project(":core:data"))
                    implementation(project(":core:network"))
                    implementation(project(":core:storage"))
                }
                sourceSets.androidMain.dependencies {
                    implementation(libs.findBundle("ktor-android").get())
                }
                sourceSets.iosMain.dependencies {
                    implementation(libs.findBundle("ktor-ios").get())
                }
            }
        }
    }
}
