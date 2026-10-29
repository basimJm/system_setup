plugins {
    alias(libs.plugins.com.acme.shop.kotlin.multiplatform.library)
}

kotlin {
    android {
        namespace = "com.acme.shop.core.di"
        compileSdk = 36
        minSdk = 26
        androidResources { enable = true }
    }
    sourceSets.commonMain.dependencies {
        implementation(libs.bundles.coroutines)
        implementation(libs.koin.core)
        implementation(projects.core.storage)
        implementation(projects.core.network)
        implementation(projects.core.data)
        implementation(projects.core.domain)
        implementation(projects.core.ui)
    }
    sourceSets.androidMain.dependencies {
        implementation(libs.koin.androidx.compose)
    }
}
