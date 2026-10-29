plugins {
    alias(libs.plugins.com.acme.shop.compose.app)
}

// Pinned so the generated resource package follows the app package rather than
// rootProject.name, which would otherwise change when the project is renamed.
compose.resources {
    publicResClass = true
    packageOfResClass = "com.acme.shop.app.resources"
}

kotlin {
    android {
        namespace = "com.acme.shop.composeapp"
        compileSdk = 36
        minSdk = 26
        androidResources { enable = true }
    }
}
