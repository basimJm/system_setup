plugins {
    alias(libs.plugins.androidApplication) apply false
    alias(libs.plugins.androidLibrary) apply false
    alias(libs.plugins.androidMultiplatformLibrary) apply false
    alias(libs.plugins.androidTest) apply false
    alias(libs.plugins.androidx.baselineprofile) apply false
    alias(libs.plugins.kotlinAndroid) apply false
    alias(libs.plugins.composeMultiplatform) apply false
    alias(libs.plugins.composeCompiler) apply false
    alias(libs.plugins.kotlinMultiplatform) apply false
    alias(libs.plugins.kotlinSerialization) apply false
    alias(libs.plugins.google.gms.google.services) apply false
    alias(libs.plugins.firebase.crashlytics) apply false
}

/** Regenerates the Kotlin contract from the server OpenAPI snapshot. */
tasks.register<Exec>("apiSync") {
    group = "contract"
    description = "Generate core/data contract DTOs + operations from ../Acme-Server/docs/api/openapi.customer.json"
    commandLine("python3", "scripts/api_sync.py")
}

/** Fails when the generated contract no longer matches the server snapshot (run by the local gate and CI). */
tasks.register<Exec>("apiSyncCheck") {
    group = "contract"
    description = "Verify the generated contract is up to date"
    commandLine("python3", "scripts/api_sync.py", "--check")
}
