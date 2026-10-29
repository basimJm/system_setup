package com.acme.shop.buildlogic

import org.gradle.api.Project
import org.jetbrains.kotlin.gradle.dsl.KotlinMultiplatformExtension

internal fun Project.configureKmpCompose(
    extension: KotlinMultiplatformExtension,
) {
    extension.apply {
        sourceSets.commonMain.dependencies {
            implementation(libs.findBundle("compose").get())
        }
        sourceSets.androidMain.dependencies {
            implementation(libs.findLibrary("compose-uiToolingPreview").get())
        }
    }
}
