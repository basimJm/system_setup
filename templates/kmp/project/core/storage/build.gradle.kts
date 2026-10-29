plugins {
    alias(libs.plugins.com.acme.shop.kotlin.multiplatform.library)
    alias(libs.plugins.ksp)
    alias(libs.plugins.androidx.room)
}

kotlin {
    android {
        namespace = "com.acme.shop.core.storage"
        compileSdk = 36
        minSdk = 26
        androidResources { enable = true }
    }
    sourceSets.commonMain.dependencies {
        implementation(projects.core.domain)
        implementation(projects.core.security)
        implementation(projects.core.ui)
        implementation(libs.bundles.coroutines)
        implementation(libs.bundles.storage)
        implementation(libs.koin.core)
        implementation(libs.androidx.room.runtime)
        implementation(libs.androidx.sqlite.bundled)
    }
    sourceSets.commonTest.dependencies {
        implementation(libs.kotlinx.coroutines.test)
    }
    sourceSets.androidMain.dependencies {
        implementation(libs.androidx.datastore.preferences)
        implementation(libs.androidx.core.ktx)
        implementation(libs.androidx.core)
        implementation(libs.androidx.room.sqlite.wrapper)
    }
}


dependencies {
    add("kspAndroid", libs.androidx.room.compiler)
    add("kspIosSimulatorArm64", libs.androidx.room.compiler)
    add("kspIosArm64", libs.androidx.room.compiler)
}

room {
    schemaDirectory("$projectDir/schemas")
}
