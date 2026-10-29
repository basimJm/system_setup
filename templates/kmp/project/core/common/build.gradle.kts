plugins {
    alias(libs.plugins.com.acme.shop.kotlin.multiplatform.library)
}

kotlin {
    android {
        namespace = "com.acme.shop.core.common"
        compileSdk = 36
        minSdk = 26
        androidResources { enable = true }
    }
    sourceSets.commonMain.dependencies {
        implementation(libs.bundles.coroutines)
        implementation(libs.kotlinx.datetime)
    }
}
