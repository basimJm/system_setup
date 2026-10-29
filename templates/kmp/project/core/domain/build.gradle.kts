plugins {
    alias(libs.plugins.com.acme.shop.kotlin.multiplatform.library)
    alias(libs.plugins.kotlinSerialization)
}

kotlin {
    android {
        namespace = "com.acme.shop.core.domain"
        compileSdk = 36
        minSdk = 26
        androidResources { enable = true }
    }
    sourceSets.commonMain.dependencies {
        implementation(libs.bundles.coroutines)
        implementation(libs.kotlinx.serialization.json)
    }
    sourceSets.commonTest.dependencies {
        implementation(libs.kotlin.test)
        implementation(libs.kotlinx.coroutines.test)
    }
}
