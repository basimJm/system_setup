plugins {
    alias(libs.plugins.com.acme.shop.core.library)
    alias(libs.plugins.kotlinSerialization)
}

// Namespace, SDK levels, coroutines and the coroutine test library come from the core.library convention plugin.
// This module owns the realtime port (RealtimeClient, events, status), the Socket.IO protocol codec and the client.
kotlin {
    sourceSets.commonMain.dependencies {
        implementation(projects.core.common)
        implementation(projects.core.domain)
        implementation(projects.core.network)
        implementation(libs.ktor.client.core)
        implementation(libs.ktor.client.websockets)
        implementation(libs.kotlinx.serialization.json)
        implementation(libs.koin.core)
    }
}
