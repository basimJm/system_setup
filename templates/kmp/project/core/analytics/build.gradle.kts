plugins {
    alias(libs.plugins.com.acme.shop.core.compose)
}

// Namespace, SDK levels, coroutines, lifecycle and test dependencies come from the core.compose convention plugin.
// This module owns the analytics port (tracker, backend, context), the validation rules and the Compose helper.
kotlin {
    sourceSets.commonMain.dependencies {
        implementation(libs.koin.core)
    }
}
