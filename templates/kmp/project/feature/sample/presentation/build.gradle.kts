plugins {
    alias(libs.plugins.com.acme.shop.feature.presentation)
}

kotlin {
    android {
        namespace = "com.acme.shop.feature.sample.presentation"
        compileSdk = 36
        minSdk = 26
        androidResources { enable = true }
    }
    sourceSets.commonMain.dependencies {
        implementation(projects.feature.sample.domain)
        implementation(projects.core.designSystem)
    }
}

// Pinned so the generated resource package follows the app package rather than
// rootProject.name, which would otherwise change when the project is renamed.
compose.resources {
    publicResClass = true
    packageOfResClass = "com.acme.shop.feature.sample.presentation.resources"
}
