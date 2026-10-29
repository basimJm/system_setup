plugins {
    alias(libs.plugins.com.acme.shop.feature.data)
}

kotlin {
    android {
        namespace = "com.acme.shop.feature.sample.data"
        compileSdk = 36
        minSdk = 26
        androidResources { enable = true }
    }
    sourceSets.commonMain.dependencies {
        implementation(projects.feature.sample.domain)
    }
}
