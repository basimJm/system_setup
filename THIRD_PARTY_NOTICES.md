# Third-party notices

This repository is MIT licensed (`LICENSE`). It bundles the third-party material below, each with its own license. Material
whose license could not be established is not included. To add something, follow `CONTRIBUTING.md`.

## Fonts
Used by the `kmp` template (`templates/kmp/project/core/design-system/src/commonMain/composeResources/font/`). The font files
embed their license in the font itself (name table, IDs 0 and 13). The full texts are kept next to the module, in
`templates/kmp/project/core/design-system/font-licenses/`, and are copied into every generated app. The fonts are used
unmodified and are not sold on their own.

| Files | Family | Copyright | License | License text |
|---|---|---|---|---|
| `poppins_regular.ttf`, `poppins_medium.ttf`, `poppins_semibold.ttf`, `poppins_bold.ttf` | Poppins 4.004 | The Poppins Project Authors (Indian Type Foundry), <https://github.com/itfoundry/Poppins> | SIL Open Font License 1.1 | `font-licenses/OFL-Poppins.txt` |
| `playfair_semibold.ttf`, `playfair_bold.ttf` | Playfair Display 1.203 | The Playfair Display Project Authors (Claus Eggers Sorensen), <https://github.com/clauseggers/Playfair-Display> | SIL Open Font License 1.1 (Reserved Font Name "Playfair Display") | `font-licenses/OFL-PlayfairDisplay.txt` |
| `plex_arabic_regular.ttf`, `plex_arabic_medium.ttf`, `plex_arabic_semibold.ttf`, `plex_arabic_bold.ttf` | IBM Plex Sans Arabic 1.101 | IBM Corp., <https://github.com/IBM/plex> | SIL Open Font License 1.1 (Reserved Font Name "Plex") | `font-licenses/OFL-IBMPlexSansArabic.txt` |

The license texts are the official `OFL.txt` files of the Google Fonts repository (<https://github.com/google/fonts>).

## Agent skills
`templates/workspace/.claude/skills/` holds four skills from the Android skills repository,
<https://github.com/android/skills> (author: Google LLC), license **Apache-2.0**: `android-profiler`, `anr-audit-and-fix`,
`jetpack-compose-performance` and `r8-analyzer`. No change was made to them in this repository. Their `SKILL.md` files say
"Complete terms in LICENSE.txt"; that text is the file `ANDROID_SKILLS_LICENSE` next to the skills, which is byte-identical to the
license file of the upstream repository (checked against the GitHub license API, SPDX `Apache-2.0`). A copy is in
`LICENSES/Apache-2.0.txt`. The generated workspace receives the skills together with the license file.

`android-profiler/references/perfetto/bin/trace_processor` is the Perfetto `trace_processor` launcher script, Copyright (C) 2021
The Android Open Source Project, Apache-2.0 (header kept in the file).

## Build tooling
`templates/kmp/project/gradlew`, `gradlew.bat` and `gradle/wrapper/gradle-wrapper.jar` are the Gradle wrapper, Copyright Gradle, Inc.
and contributors, Apache-2.0 (header kept in the scripts; full text in `LICENSES/Apache-2.0.txt`). The wrapper downloads Gradle
itself from `services.gradle.org` when a generated project is built.

## Images
All images are generated placeholders created for this repository (a ring and a dot on a flat background; the admin favicon is
an SVG of the same mark). They carry no third-party artwork and are released under the MIT license of this repository. They are
neutral stand-ins: replace the icons and logo before releasing an app (`templates/kmp/project/README.md`, "Replace before release").

| Files | What they are |
|---|---|
| `templates/admin/public/favicon.svg`, `templates/admin/src/assets/app-icon.png` | admin panel favicon and header icon |
| `templates/kmp/project/androidApp/src/main/ic_launcher-playstore.png`, `.../res/mipmap-*/ic_launcher*.webp` | Android launcher icons (15 webp) |
| `templates/kmp/project/core/design-system/src/commonMain/composeResources/drawable/ic_app_*.webp` | in-app logo (light, dark) and icon |
| `templates/kmp/project/iosApp/iosApp/Assets.xcassets/AppIcon.appiconset/app_icon.png` | iOS app icon |
| `tests/fixtures/templates/**/logo.png`, `ic_launcher.png` | a few bytes of fake data used by the engine tests |

## npm and Gradle dependencies
The templates declare dependencies (`package.json`, `package-lock.json`, `gradle/libs.versions.toml`); they are downloaded when a
generated project is installed or built, not stored here. Each keeps its own license. `package-lock.json` files record the
public metadata of those packages.
