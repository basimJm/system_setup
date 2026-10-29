import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    `kotlin-dsl`
}

group = "com.acme.shop.buildlogic"

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_21
    }
}

dependencies {
    compileOnly(libs.android.gradlePlugin)
    compileOnly(libs.android.gradlePluginApi)
    compileOnly(libs.kotlin.gradlePlugin)
    compileOnly(libs.compose.gradlePlugin)
    compileOnly(libs.compose.compiler.gradlePlugin)
    compileOnly(libs.baselineprofile.gradlePlugin)
}

gradlePlugin {
    plugins {
        register("kotlinMultiplatformLibrary") {
            id = "com.acme.shop.kotlin.multiplatform.library"
            implementationClass = "com.acme.shop.buildlogic.KotlinMultiplatformLibraryPlugin"
        }
        register("composeApp") {
            id = "com.acme.shop.compose.app"
            implementationClass = "com.acme.shop.buildlogic.ComposeAppPlugin"
        }
        register("androidApp") {
            id = "com.acme.shop.android.app"
            implementationClass = "com.acme.shop.buildlogic.AndroidAppPlugin"
        }
        register("coreLibrary") {
            id = "com.acme.shop.core.library"
            implementationClass = "com.acme.shop.buildlogic.KmpCoreLibraryPlugin"
        }
        register("coreCompose") {
            id = "com.acme.shop.core.compose"
            implementationClass = "com.acme.shop.buildlogic.KmpCoreComposePlugin"
        }
        register("featureDomain") {
            id = "com.acme.shop.feature.domain"
            implementationClass = "com.acme.shop.buildlogic.KmpFeatureDomainPlugin"
        }
        register("featureData") {
            id = "com.acme.shop.feature.data"
            implementationClass = "com.acme.shop.buildlogic.KmpFeatureDataPlugin"
        }
        register("featurePresentation") {
            id = "com.acme.shop.feature.presentation"
            implementationClass = "com.acme.shop.buildlogic.KmpFeaturePresentationPlugin"
        }
        register("baselineProfile") {
            id = "com.acme.shop.baseline.profile"
            implementationClass = "com.acme.shop.buildlogic.BaselineProfilePlugin"
        }
        register("featureDi") {
            id = "com.acme.shop.feature.di"
            implementationClass = "com.acme.shop.buildlogic.KmpFeatureDiPlugin"
        }
    }
}
