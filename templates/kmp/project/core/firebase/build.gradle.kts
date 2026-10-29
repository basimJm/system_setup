plugins {
    alias(libs.plugins.com.acme.shop.core.library)
}

// Firebase stays behind the ports of this module (root CLAUDE.md §6): Android implements them on the Firebase
// Android SDK; iOS implements them in Swift (the Xcode project links the Firebase iOS SDK) through the bridges below.
kotlin {
    sourceSets.commonMain.dependencies {
        implementation(libs.koin.core)
        api(projects.core.analytics)
    }
    sourceSets.androidMain.dependencies {
        implementation(libs.bundles.koin.android)
        implementation(libs.firebase.analytics)
        implementation(libs.firebase.crashlytics)
        implementation(libs.firebase.messaging)
    }
}
