# Acme Shop — Memory (durable facts; keep short, replace instead of append)

- Generated from the SYSTEM_SETUP `kmp` template: `build-logic` convention plugins, `core/*` (design system with Liquid Glass, MVI, Ktor network + mock engine, storage, security, realtime, analytics, Firebase ports, notifications, navigation, DI), `feature/sample`.
- Package `com.acme.shop`; dev id `com.acme.shop.dev`; API prefix `/app/v1`; dev builds use `DATA_SOURCE=mock` (mock = fixtures each feature binds as `MockFixture` in its data Koin module).
- New feature = copy `feature/sample`, add it to `settings.gradle.kts`, `ComposeAppPlugin.FEATURE_MODULES`, `appModules` (App.kt) and `MainNavigation`.
