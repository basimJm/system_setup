# R8 rules for the release variants of the app (see CLAUDE.md §5). Library rules ship with their AARs;
# shared data/serialization rules live in ../data-proguard-rules.pro.

# Keep line numbers so release crash reports stay readable.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Optional logging backends that Ktor references but the app does not ship.
-dontwarn org.slf4j.**
-dontwarn java.lang.management.**
-dontwarn javax.naming.**

# CUS-097: class NAMES read at runtime (names only; R8 still shrinks and optimizes the members).
# - RootTab.routeName compares `Graph::class.qualifiedName` with NavDestination.route (the serial name): an
#   obfuscated graph name hid the bottom tab bar in release builds.
# - AnalyticsCatalog.screenNameOf (`Screen::class.simpleName`) and the action owner (`ViewModel::class.simpleName`)
#   become analytics parameters.
-keepattributes InnerClasses,EnclosingMethod
-keepnames class com.acme.shop.core.navigation.route.**
-keepnames class * extends com.acme.shop.core.mvi.BaseViewModel
