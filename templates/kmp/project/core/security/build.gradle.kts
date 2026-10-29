plugins {
    alias(libs.plugins.com.acme.shop.kotlin.multiplatform.library)
}

kotlin {
    android {
        namespace = "com.acme.shop.core.security"
        compileSdk = 36
        minSdk = 26
        androidResources { enable = true }
    }
}
