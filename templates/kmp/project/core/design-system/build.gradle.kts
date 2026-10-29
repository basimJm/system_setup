plugins {
    alias(libs.plugins.com.acme.shop.kotlin.multiplatform.library)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
}

// Pinned so the generated resource package follows the app package rather than
// rootProject.name, which would otherwise change when the project is renamed.
compose.resources {
    publicResClass = true
    packageOfResClass = "com.acme.shop.designsystem.resources"
}

kotlin {
    android {
        namespace = "com.acme.shop.core.designsystem"
        compileSdk = 36
        minSdk = 26
        androidResources { enable = true }
    }
    sourceSets.commonMain.dependencies {
        implementation(libs.bundles.compose)
        api(libs.compose.uiToolingPreview)
        implementation(projects.core.ui)
        implementation(projects.core.domain)
        implementation(libs.kotlinx.datetime)
        implementation(libs.haze)
        implementation(libs.jetbrains.navigationevent.compose)
        api(libs.material.icons.extended)
    }
    sourceSets.androidMain.dependencies {
        implementation(libs.compose.uiTooling)
        implementation(libs.androidx.core.ktx)
    }
}
