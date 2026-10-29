# ── DTOs (data layer) ──
-keep class com.acme.shop.feature.**.data.remote.dto.** { *; }
-keep class com.acme.shop.core.data.** { *; }
# CUS-095: no blanket keep on core.network or domain models any more. They are never looked up by reflection;
# @Serializable classes among them stay through the serializer rules below (and the kotlinx.serialization
# consumer rules), so R8 can now inline, shrink and obfuscate them.

# ── kotlinx.serialization ──
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.acme.shop.**$$serializer { *; }
-keepclassmembers class com.acme.shop.** {
    *** Companion;
}
-keepclasseswithmembers class com.acme.shop.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# ── Ktor ──
# CUS-095: the blanket `-keep class io.ktor.** { *; }` is gone. Engines are created explicitly (OkHttp / Darwin via
# HttpEngineProvider), so no ServiceLoader lookup needs them, and Ktor 3 ships its own consumer rules.
-dontwarn io.ktor.**
-keep class kotlin.coroutines.Continuation
