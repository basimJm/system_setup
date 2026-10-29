import plistlib
import unittest
from support import TempProject
from policy import security

MANIFEST = """<manifest xmlns:android="http://schemas.android.com/apk/res/android">
<application {attrs}>
<activity android:name=".Main" android:exported="true"><intent-filter><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity>
{extra}
</application></manifest>"""


def manifest(attrs="", extra=""):
    return MANIFEST.format(attrs=attrs, extra=extra)


class ManifestTest(unittest.TestCase):
    def messages(self, text):
        return [v.message for v in security.check_manifest("AndroidManifest.xml", text)]

    def test_safe_manifest(self):
        self.assertEqual(self.messages(manifest('android:allowBackup="false"')), [])

    def test_forbidden_flags(self):
        found = self.messages(manifest('android:allowBackup="true" android:usesCleartextTraffic="true" android:debuggable="true"'))
        self.assertEqual(len(found), 3)

    def test_exported_component_needs_permission_unless_launcher(self):
        bad = '<service android:name=".S" android:exported="true"/>'
        good = '<service android:name=".S" android:exported="true" android:permission="p.PERM"/>'
        self.assertEqual(len(self.messages(manifest(extra=bad))), 1)
        self.assertEqual(self.messages(manifest(extra=good)), [])
        self.assertEqual(self.messages(manifest(extra='<service android:name=".S" android:exported="false"/>')), [])


class PlistGradleTest(unittest.TestCase):
    def test_ats(self):
        bad = plistlib.dumps({"NSAppTransportSecurity": {"NSAllowsArbitraryLoads": True}})
        self.assertEqual(len(security.check_plist("Info.plist", bad)), 1)
        self.assertEqual(security.check_plist("Info.plist", plistlib.dumps({"A": 1})), [])

    def test_repositories_and_signing(self):
        self.assertEqual(len(security.check_gradle("a.kts", 'maven { url = uri("http://x.com") }')), 1)
        self.assertEqual(len(security.check_gradle("a.kts", "maven { isAllowInsecureProtocol = true }\nallowInsecureProtocol = true")), 1)
        self.assertEqual(len(security.check_gradle("a.kts", 'storePassword = "' + "dummy" + "pass" + '"')), 1)
        self.assertEqual(security.check_gradle("a.kts", 'storePassword = providers.gradleProperty("P").get()\nmaven { url = uri("https://x.com") }'), [])

    def test_dynamic_versions_only_in_version_catalog(self):
        self.assertEqual(len(security.check_gradle("gradle/libs.versions.toml", 'ktor = "3.+"')), 1)
        self.assertEqual(len(security.check_gradle("gradle/libs.versions.toml", 'ktor = "1.0-SNAPSHOT"')), 1)
        self.assertEqual(security.check_gradle("gradle/libs.versions.toml", 'ktor = "3.4.2"'), [])
        self.assertEqual(security.check_gradle("a.kts", 'val x = "1.+"'), [])


class RunnerTest(TempProject):
    def test_secret_files_and_manifest_are_found(self):
        self.write("androidApp/src/main/AndroidManifest.xml", manifest('android:allowBackup="true"'))
        self.write("androidApp/release.jks", "x")
        self.write("core/a/.env.production", "K=v")
        found = security.check(self.config)
        self.assertEqual(sorted(v.rule for v in found), ["S001", "S004", "S004"])

    def test_clean_project(self):
        self.write("androidApp/src/main/AndroidManifest.xml", manifest('android:allowBackup="false"'))
        self.write("gradle/libs.versions.toml", '[versions]\nkotlin = "2.3.20"\n')
        self.assertEqual(security.check(self.config), [])


if __name__ == "__main__":
    unittest.main()
