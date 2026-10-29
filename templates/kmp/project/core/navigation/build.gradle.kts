plugins {
    alias(libs.plugins.com.acme.shop.kotlin.multiplatform.library)
    alias(libs.plugins.kotlinSerialization)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
}

kotlin {
    android {
        namespace = "com.acme.shop.core.navigation"
        compileSdk = 36
        minSdk = 26
        androidResources { enable = true }
    }
    sourceSets.commonMain.dependencies {
        implementation(libs.bundles.coroutines)
        api(libs.jetbrains.navigation.compose)
        implementation(libs.kotlinx.serialization.core)
        implementation(libs.compose.foundation)
        implementation(libs.compose.runtime)
    }
}
