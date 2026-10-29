plugins {
    alias(libs.plugins.com.acme.shop.kotlin.multiplatform.library)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
}

kotlin {
    android {
        namespace = "com.acme.shop.core.notification"
        compileSdk = 36
        minSdk = 26
        androidResources { enable = true }
    }
    sourceSets.commonMain.dependencies {
        implementation(libs.bundles.compose)
        implementation(libs.bundles.coroutines)
        implementation(libs.bundles.lifecycle)
        implementation(libs.bundles.koin)
    }
}
