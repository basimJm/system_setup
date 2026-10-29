plugins {
    alias(libs.plugins.com.acme.shop.kotlin.multiplatform.library)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
}

kotlin {
    android {
        namespace = "com.acme.shop.core.ui"
        compileSdk = 36
        minSdk = 26
        androidResources { enable = true }
    }
    sourceSets.commonMain.dependencies {
        implementation(libs.bundles.coroutines)
        implementation(libs.bundles.lifecycle)
        implementation(libs.compose.runtime)
        implementation(libs.compose.foundation)
        implementation(libs.koin.core)
        api(projects.core.notification)
    }
    sourceSets.commonTest.dependencies {
        implementation(libs.kotlin.test)
        implementation(libs.kotlinx.coroutines.test)
    }
    sourceSets.androidMain.dependencies {
        implementation(libs.androidx.activity.compose)
        implementation(libs.androidx.core.ktx)
        implementation(libs.androidx.exifinterface)
    }
}
