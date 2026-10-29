# SYSTEM_SETUP template `kmp` — generic Kotlin Multiplatform app

A ready-to-instantiate Kotlin Multiplatform app (Android + iOS, Compose Multiplatform) stored as a **snapshot of
`KMP_TEMPLATE` output** under `project/` (553 files, ~4.9 MB, no build outputs, no real Firebase files, no keystores).
The snapshot carries one fixed **sentinel identity** (`Acme Shop` / `com.acme.shop` / `AcmeShop`, see §2); the
SYSTEM_SETUP engine turns it into a new app by plain string substitution of text and paths. `instantiate.py` is the
reference implementation of that step and `TEMPLATE.json` the machine-readable contract.

## 1. Contents of `project/`

| Area | What is inside |
|---|---|
| `build-logic/convention` | Convention plugins (`<package>.kotlin.multiplatform.library`, `.core.library`, `.feature.{domain,data,presentation,di}`, `.android.app`, `.compose.app`); feature modules are registered once in `ComposeAppPlugin.FEATURE_MODULES` |
| `core/common` | Result/errors, formatters, validators, dispatchers, logging, `expect/actual` platform helpers |
| `core/domain`, `core/data` | Base use cases/repositories, Ktor client, `BaseResponse` envelope, **mock engine** (`MockTransport`, `MockScenarios`, per-feature `MockFixture` bound in `MockDataModule`; dev builds run with `DATA_SOURCE=mock`) |
| `core/network` | Auth endpoints, access/refresh token store, `AuthRefreshInterceptor` (single-flight refresh), error envelope DTOs, `Accept-Language` |
| `core/storage`, `core/security` | DataStore preferences, secure storage (Keychain / EncryptedSharedPreferences), session |
| `core/realtime` | Socket.IO client over Ktor WebSockets (`RealtimeConfig.APP_NAMESPACE`), reconnect, refresh triggers |
| `core/mvi` | **MVI by delegate**: `MVI<State, Action, Effect>`, `MVIDelegate`, `BaseViewModel` (`by mvi(...)`), `UiActionObserver` |
| `core/navigation`, `core/ui` | Typed routes, deep links, external links, back handling, lifecycle helpers, previews |
| `core/design-system` | Tokens (color, type, spacing, shape, motion), light/dark themes, RTL-aware components (avatar, badge, button, card, chip, controls, dialog, feedback, form, image, layout, media, navigation, pager, rating), **Liquid Glass** (`components/glass/{LiquidGlass,GlassEffects,AppGlassSurface}.kt`), brand resources (`brand_name`), shared `composeResources` strings AR + EN |
| `core/analytics`, `core/firebase`, `core/notification` | Analytics port + Firebase adapter, Firebase ports (push, Crashlytics, App Check), notification channels/permissions |
| `core/di` | Koin wiring, `appModules` |
| `feature/sample/{domain,data,presentation,di}` | The reference feature: use case → repository → ViewModel (`by mvi`) → stateless screen with loading/empty/error states and a mock fixture; copy it per feature |
| `composeApp/` | App shell: theme, language/RTL switch, dark mode, navigation host, push + deep-link entry, Koin start |
| `androidApp/`, `iosApp/` | Hosts: flavors `dev`/`prod`, Xcode project with schemes `iosApp-Dev`/`iosApp-Prod`, `Configuration/{Config,Dev,Prod}.xcconfig`, `Firebase/{dev,prod}` placeholders, Swift Firebase bridges |
| `scripts/ci` | `policy_checks.py all` (policies in `scripts/ci/policy/`: hardcoded values, security, localization AR/EN parity, file length, budgets, variants, error codes, quality, baseline) + 93 unit tests in `scripts/ci/tests`; `run_detekt.sh` (`config/detekt/detekt.yml`); `run_ios_checks.sh`; `run_local_checks.sh` = the full local gate |
| `scripts/` | `api_sync.py` (OpenAPI → DTOs, `./gradlew apiSync`), `contract_gaps.py`, `contract_fixtures.py`, `capture_remote_fixtures.py`, `capture_otp.py` |
| `config/` | `policy.json`, `policy-baseline.json`, `budgets.json`, `lint.xml`, `swiftlint.yml`, `remote-capture.json` |
| `.github/workflows/ci.yml` | Self-contained CI (policy, detekt, unit tests, Android variants, iOS) |
| `.claude/{rules,roles,session,memory}.md` + `CLAUDE.md` | Working rules (branch per task, no hardcoding, unit tests, one verification loop, four-role review), roles, empty session/memory; `BUSINESS_DOMAIN.md` and `TECHSTACK.md` stubs; `gradle/` wrapper 9.3.1, `libs.versions.toml` |

Not shipped: `docs/api/openapi.json` (the contract check is skipped until the project adds its spec), real Firebase
configs, signing material, `local.properties`, `Local.xcconfig`.

## 2. Sentinel contract (what the engine substitutes)

Every identity value appears in the snapshot as one fixed literal. Replace **longest literal first**, plain string
replacement (no regex), in file contents **and** in paths. `TEMPLATE.json` → `sentinels` is authoritative; this table
is the human copy. Counts are files containing the literal.

| Literal in the snapshot | Placeholder | Files | Where |
|---|---|---|---|
| `Acme Shop` | `__APP_NAME__` | 11 | Android `strings.xml` (`app_name`, dev = `Acme Shop Dev`), design-system `brand_name`, `Dev/Prod.xcconfig` `APP_DISPLAY_NAME`, README/CLAUDE/.claude docs |
| `متجر أكمي` | `__APP_NAME_AR__` | 2 | `values-ar/strings.xml` (main + dev) |
| `com.acme.shop` | `__APP_PACKAGE__` | 416 | every Kotlin `package`/`import`, plugin ids in `build-logic` + `libs.versions.toml`, `applicationId`, Android `namespace`, proguard, placeholder Firebase ids (`com.acme.shop.dev`), `PRODUCT_BUNDLE_IDENTIFIER = com.acme.shop$(BUNDLE_ID_SUFFIX)`, `api_sync.py` |
| `com-acme-shop` | `__APP_PACKAGE_DASHED__` (derived) | 1 | version-catalog plugin aliases (`libs.plugins.com.acme.shop.*`) |
| `com/acme/shop` | `__APP_PACKAGE_PATH__` (derived) | 5 text + 56 dirs | source folders `src/<set>/kotlin/com/acme/shop/**`, `build-logic/.../com/acme/shop/buildlogic`, keys in `config/policy-baseline.json`, path strings in `scripts/ci/policy/{variants,error_codes}.py`, `scripts/ci/tests/test_variants.py`, `scripts/api_sync.py` |
| `AcmeShop` | `__APP_PROJECT__` | 10 | `settings.gradle.kts` `rootProject.name`, `Config.xcconfig` `PRODUCT_NAME`, `project.pbxproj` (`AcmeShop.app`), both `.xcscheme` `BuildableName`, `FirebaseBridges.swift` NSError domain, `ci.yml`, `detekt.yml`, `policy_checks.py`, `policy/__init__.py` |
| `https://api-dev.example.com` / `api-dev.example.com` | `__DEV_API_URL__` / `__DEV_API_HOST__` | 3 | `gradle.properties` `DEV_API_BASE_URL`; `Dev.xcconfig` `API_BASE_URL = https:/$()/api-dev.example.com` (xcconfig cannot hold `//`, so only the **host** is literal there) |
| `https://api.example.com` / `api.example.com` | `__PROD_API_URL__` / `__PROD_API_HOST__` | 4 | `gradle.properties`, `Prod.xcconfig`, README, one test literal in `test_hardcoded.py` |
| `https://app-dev.example.com` / `app-dev.example.com` | `__DEV_WEB_URL__` / `__DEV_WEB_HOST__` | 2 | `gradle.properties` `DEV_WEB_BASE_URL`; `Dev.xcconfig` `WEB_BASE_URL` + `DEEP_LINK_HOST` (entitlements use `applinks:$(DEEP_LINK_HOST)`) |
| `https://app.example.com` / `app.example.com` | `__PROD_WEB_URL__` / `__PROD_WEB_HOST__` | 2 | `gradle.properties`, `Prod.xcconfig` |
| `TEAMID0000` | `__APPLE_TEAM_ID__` | 1 | `Config.xcconfig` `TEAM_ID` (`DEVELOPMENT_TEAM = $(TEAM_ID)`) |
| `/app/v1` | `__API_PREFIX__` | 9 | `AuthEndpoints.kt`, its test, `api_sync.py` `NAMESPACE_PREFIX`, `capture_remote_fixtures.py`, two CI tests, README/CLAUDE/memory |
| `WAB-Server` | `__SERVER_DIR__` | 7 | `apiSync` default spec path `../WAB-Server/docs/api/openapi.customer.json` and KDoc comments |
| `const val APP_NAMESPACE = "/app"` | `__REALTIME_NAMESPACE__` (**targeted edit**) | 1 | `core/realtime/.../RealtimeConfig.kt` only. `/app` is never replaced globally: `SocketIoProtocolTest` and `SocketIoRealtimeClientTest` use `40/app,` packets as fixed protocol test data (the client test pins `namespace = TEST_NAMESPACE` on its `RealtimeConfig`, so any configured default works) |

Derived values: `__APP_PACKAGE_DASHED__` = package with `-`, `__APP_PACKAGE_PATH__` = package with `/`,
`__*_HOST__` = host of the matching URL (URLs must be `https://<host>` with no path). `__APP_DIR__`, `__SYSTEM_NAME__`
and `__SYSTEM_PREFIX__` have no literal in the snapshot. Dev ids are `__APP_PACKAGE__ + ".dev"` through
`DEV_APPLICATION_ID_SUFFIX` / `BUNDLE_ID_SUFFIX`; nothing extra to rename.

### Package-path rename rule
Kotlin source trees are **folders**, so the package rename is a path rename, not only a text edit: for every file,
compute the destination as `substitute(relative_path, rename_paths)` with `rename_paths` =
`{"com/acme/shop": __APP_PACKAGE_PATH__, "AcmeShop": __APP_PROJECT__}` (longest literal first), create the parent
folders, then write the substituted content there. `AcmeShop` is in `rename_paths` for forward compatibility (no file or
folder is literally named `AcmeShop` today). After writing, scan every path and every text file for every sentinel and
fail if any is left (`instantiate.py::verify`).

### What stays on purpose (neutral, not identity)
`WAB-…` reference numbers and `help@wab.jo` in test data, the lint cache dir `wab-customer-lint`, `sara@example.com` /
`name@example.com` in a validator test and a preview, and the Firebase placeholder project ids
`firebase-{dev,prod}-placeholder`. None of them is a sentinel; a project may rename them freely.

## 3. Reference instantiation

```bash
python3 .claude/tools/SYSTEM_SETUP/templates/kmp/instantiate.py --target /path/BetaStore \
  --app-name "Beta Store" --app-name-ar "متجر بيتا" --package io.beta.store --project-name BetaStore \
  --dev-api-url https://api-dev.beta.io --prod-api-url https://api.beta.io \
  --dev-web-url https://app-dev.beta.io --prod-web-url https://app.beta.io --team-id ABCDE12345 \
  --api-prefix /store/v1 --realtime-namespace /store --server-dir Beta-Server
```

Proven 2026-10-28 with exactly this identity (`$TMPDIR/beta-kmp`): 553 files written, 56 package folders renamed, no
sentinel left; `python3 -m unittest discover -s scripts/ci/tests` 93 OK; `python3 scripts/ci/policy_checks.py all` →
`all: ok`; `scripts/ci/run_detekt.sh` exit 0, no findings; `./gradlew testAndroidHostTest :androidApp:assembleDevDebug
:composeApp:linkDebugFrameworkIosSimulatorArm64` BUILD SUCCESSFUL (results recorded in the task block of the
`feat/system-setup-kmp` branch). Firebase stays off in the new app until its real config files replace the placeholders
(`androidApp/src/{dev,prod}/google-services.json`, `iosApp/Firebase/{dev,prod}/GoogleService-Info.plist`); set the
real Apple team in `iosApp/Configuration/Local.xcconfig` or `--team-id`.

## 4. Regenerating the snapshot from a newer customer app

The snapshot is `KMP_TEMPLATE` output with the sentinel identity. From the monorepo root, on the `customer` master:

```bash
rm -rf "$TMPDIR/AcmeShop" && \
.claude/tools/KMP_TEMPLATE/KMP_TEMPLATE --yes --no-git --target "$TMPDIR/AcmeShop" \
  --app-name "Acme Shop" --app-name-ar "متجر أكمي" --package com.acme.shop --project-name AcmeShop \
  --dev-api-url https://api-dev.example.com --prod-api-url https://api.example.com \
  --dev-web-url https://app-dev.example.com --prod-web-url https://app.example.com \
  --team-id TEAMID0000 --api-prefix /app/v1 --realtime-namespace /app --dev-data-source mock
```

Then:
1. Remove anything the generator or a gate left behind: `build/`, `.gradle/`, `.kotlin/`, `local.properties`, `.DS_Store`,
   `DerivedData`, `xcuserdata` (`TEMPLATE.json` → `skip`). Never copy real Firebase files, keystores or `Local.xcconfig`.
2. Neutralize the Firebase placeholder project id: KMP_TEMPLATE derives it from the package's last segment
   (`shop-dev-placeholder`); replace with `firebase-dev-placeholder` / `firebase-prod-placeholder` in the four placeholder
   files, otherwise `shop` leaks into every new app.
3. `rm -rf templates/kmp/project && cp -R "$TMPDIR/AcmeShop" templates/kmp/project`; keep the execute bits of `gradlew`
   and `scripts/ci/*.sh`.
4. Re-run the sweep of §2 (`grep -rlF` for every literal, `grep -rniE 'acme|shop'` minus the known forms, `"/app`
   literals, `example.com`, `WAB`) and update `sentinels`, `sentinel_locations`, `targeted`, the counts in this README
   and `source.customer_app_commit` in `TEMPLATE.json`. Any new literal of the identity that the generator emits must
   become a sentinel or be neutralized; a value too short to replace globally becomes a `targeted` edit.
5. Instantiate a second identity (§3) and run `post_generate` from `TEMPLATE.json` on it; then delete its build outputs.

## 5. Limits
- Plain substitution: the new package must be lower-case dotted segments, the project name a CamelCase identifier, URLs
  `https://<host>` without path; the sentinels are chosen so no shorter literal is a substring of a longer one's
  replacement, but a new value that itself contains a sentinel (e.g. an app literally called "Acme Shop") is not supported.
- The realtime namespace is a single targeted edit (`/app` is too short for global replacement).
- Icons, logo (`core/design-system/.../composeResources/drawable`), colors and fonts still show the template brand;
  `project/README.md` → "Replace before release" lists them.
- No OpenAPI spec is shipped: `./gradlew apiSync` expects `../__SERVER_DIR__/docs/api/openapi.customer.json` (or
  `--spec`); the contract gate is skipped until a spec exists.
- The snapshot follows the customer app only when regenerated (§4); it is a copy, not a live link.
- `instantiate.py` refuses a non-empty target and has no `--merge`; use KMP_TEMPLATE for merging into an existing folder.
