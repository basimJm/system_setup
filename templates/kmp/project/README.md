# Acme Shop

Kotlin Multiplatform app (Android + iOS, Compose Multiplatform) generated from the SYSTEM_SETUP `kmp` template:
convention plugins, core modules, SDKs and third parties, with one sample feature.

| | Android | iOS |
|---|---|---|
| Dev | flavor `dev`, applicationId `com.acme.shop.dev` | scheme `iosApp-Dev`, bundle id `com.acme.shop.dev` |
| Prod | flavor `prod`, applicationId `com.acme.shop` | scheme `iosApp-Prod`, bundle id `com.acme.shop` |

API: dev `https://api-dev.example.com`, prod `https://api.example.com`, path prefix `/app/v1`; dev builds use `DATA_SOURCE=mock`
(`mock` serves the fixtures each feature binds, e.g. the sample list). URLs live in `gradle.properties` (Android) and `iosApp/Configuration/{Dev,Prod}.xcconfig` (iOS;
in an xcconfig write `https:/$()/host`, because `//` starts a comment).

## Firebase
- androidApp/src/dev/google-services.json: PLACEHOLDER for com.acme.shop.dev (app runs without Firebase until you add the real file)
- androidApp/src/prod/google-services.json: PLACEHOLDER for com.acme.shop (app runs without Firebase until you add the real file)
- iosApp/Firebase/dev/GoogleService-Info.plist: PLACEHOLDER for com.acme.shop.dev (app runs without Firebase until you add the real file)
- iosApp/Firebase/prod/GoogleService-Info.plist: PLACEHOLDER for com.acme.shop (app runs without Firebase until you add the real file)

Placeholders build and run; Firebase (push, analytics, Crashlytics, phone auth, App Check) stays off until the
real files are in place:
- Android: `androidApp/src/dev/google-services.json`, `androidApp/src/prod/google-services.json`
- iOS: `iosApp/Firebase/dev/GoogleService-Info.plist`, `iosApp/Firebase/prod/GoogleService-Info.plist` (copied into the app by the "Copy Firebase Config" build phase)
Register the dev and prod ids above in your Firebase projects (debug SHA-1/SHA-256 for phone auth; APNs key for push).

## Run
```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk"
./gradlew :androidApp:installDevDebug
open iosApp/iosApp.xcodeproj   # scheme iosApp-Dev; set your team in iosApp/Configuration/Local.xcconfig (see Local.xcconfig.example)
scripts/ci/run_local_checks.sh  # policy, detekt, unit tests, every Android variant, iOS configurations
```

## Structure
- `build-logic/` convention plugins (KMP library, core library/compose, feature domain/data/presentation/di, Android app, compose app)
- `core/*` common, domain, data (Ktor + mock engine), network, storage (DataStore), security, realtime (Socket.IO), navigation,
  mvi, analytics, firebase, notification, ui, design-system (tokens, Liquid Glass components), di
- `feature/sample/{domain,data,presentation,di}` the reference feature; copy it for each new feature, then add the modules to
  `settings.gradle.kts`, `ComposeAppPlugin.FEATURE_MODULES` and `appModules` in `composeApp/.../app/ui/App.kt`
- `composeApp/` app shell (theme, language/RTL, dark mode, navigation host, push, deep links); `androidApp/`, `iosApp/` hosts

## Replace before release
- App icons (`androidApp/src/main/res/mipmap-*`, `iosApp/iosApp/Assets.xcassets/AppIcon.appiconset`) and the in-app logo
  (`core/design-system/.../composeResources/drawable`) still show the template brand.
- Colors and fonts: `core/design-system/.../theme`.
- `docs/api/openapi.json`: put your backend spec there and run `python3 scripts/api_sync.py` to generate DTOs into `core/data/.../contract/generated`.
