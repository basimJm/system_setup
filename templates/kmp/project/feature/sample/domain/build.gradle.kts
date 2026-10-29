plugins {
    alias(libs.plugins.com.acme.shop.feature.domain)
}

kotlin {
    android {
        namespace = "com.acme.shop.feature.sample.domain"
        compileSdk = 36
        minSdk = 26
        androidResources { enable = true }
    }
}
