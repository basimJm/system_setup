plugins {
    alias(libs.plugins.com.acme.shop.kotlin.multiplatform.library)
    alias(libs.plugins.kotlinSerialization)
}

kotlin {
    android {
        namespace = "com.acme.shop.core.network"
        compileSdk = 36
        minSdk = 26
        androidResources { enable = true }
    }
    sourceSets.commonMain.dependencies {
        implementation(libs.bundles.network)
        implementation(projects.core.common)
        implementation(projects.core.domain)
        implementation(projects.core.storage)
        implementation(libs.koin.core)
    }
    sourceSets.commonTest.dependencies {
        implementation(libs.kotlin.test)
        implementation(libs.kotlinx.coroutines.test)
        implementation(libs.ktor.client.mock)
    }
    sourceSets.androidMain.dependencies {
        implementation(libs.bundles.ktor.android)
    }
    sourceSets.iosMain.dependencies {
        implementation(libs.bundles.ktor.ios)
    }
}
