plugins {
    alias(libs.plugins.com.acme.shop.feature.di)
}

kotlin {
    android {
        namespace = "com.acme.shop.feature.sample.di"
        compileSdk = 36
        minSdk = 26
        androidResources { enable = true }
    }
    sourceSets.commonMain.dependencies {
        implementation(projects.feature.sample.domain)
        implementation(projects.feature.sample.data)
    }
}
