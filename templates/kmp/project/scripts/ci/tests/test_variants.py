import unittest
from support import TempProject
from policy import variants

PLUGIN = "build-logic/convention/src/main/kotlin/com/acme/shop/buildlogic/AndroidAppPlugin.kt"
PBXPROJ = "iosApp/iosApp.xcodeproj/project.pbxproj"
SCHEMES = "iosApp/iosApp.xcodeproj/xcshareddata/xcschemes"
WORKFLOW = ".github/workflows/ci.yml"
SCHEME_XML = (
    '<Scheme><BuildAction/><TestAction buildConfiguration="Debug-{e}"/><LaunchAction buildConfiguration="Debug-{e}"/>'
    '<ProfileAction buildConfiguration="Release-{e}"/><AnalyzeAction buildConfiguration="Debug-{e}"/>'
    '<ArchiveAction buildConfiguration="Release-{e}"/></Scheme>'
)
XCCONFIG = "APP_ENV = {e}\nAPI_BASE_URL = https:/$()/x\nAPP_DISPLAY_NAME = WAB\nPRODUCT_BUNDLE_IDENTIFIER = com.x\nDATA_SOURCE = mock\n"


class VariantsTest(TempProject):
    def setUp(self):
        super().setUp()
        self.build_valid()

    def build_valid(self):
        self.write(PLUGIN, 'productFlavors { create("dev") {} create("prod") {} }\nbuildTypes { getByName("debug") {} getByName("release") {} }')
        self.write("gradle.properties", "DEV_API_BASE_URL=https://dev.example\nPROD_API_BASE_URL=https://example\nDEV_DATA_SOURCE=mock\nPROD_DATA_SOURCE=remote\n")
        names = "\n".join(f"\t\t\tname = {n};" for n in ["Debug-Dev", "Release-Dev", "Debug-Prod", "Release-Prod"])
        self.write(PBXPROJ, names)
        for scheme, env in (("iosApp-Dev", "Dev"), ("iosApp-Prod", "Prod")):
            self.write(f"{SCHEMES}/{scheme}.xcscheme", SCHEME_XML.format(e=env))
            self.write(f"iosApp/Configuration/{env}.xcconfig", XCCONFIG.format(e=env))
        wf = self.root.parent / WORKFLOW
        wf.parent.mkdir(parents=True)
        wf.write_text("dev prod debug release iosApp-Dev iosApp-Prod Debug-Dev Release-Dev Debug-Prod Release-Prod", encoding="utf-8")

    def messages(self):
        return [v.message for v in variants.check(self.config)]

    def test_valid_project_passes(self):
        self.assertEqual(self.messages(), [])

    def test_missing_android_flavor(self):
        self.write(PLUGIN, 'create("dev")\ngetByName("debug") getByName("release")')
        self.assertIn("product flavor 'prod' is not declared", self.messages())

    def test_missing_build_type_and_property(self):
        self.write(PLUGIN, 'create("dev") create("prod") getByName("debug")')
        self.write("gradle.properties", "DEV_API_BASE_URL=\n")
        messages = self.messages()
        self.assertIn("build type 'release' is not configured", messages)
        self.assertIn("missing or empty property DEV_API_BASE_URL", messages)
        self.assertIn("missing or empty property PROD_API_BASE_URL", messages)

    def test_ios_configuration_missing_or_unscoped(self):
        self.write(PBXPROJ, "name = Debug-Dev;\nname = Release-Dev;\nname = Debug-Prod;\nname = Debug;")
        messages = self.messages()
        self.assertIn("build configuration 'Release-Prod' is missing", messages)
        self.assertTrue(any("unscoped configuration 'Debug'" in m for m in messages))

    def test_scheme_wrong_configuration_or_missing(self):
        self.write(f"{SCHEMES}/iosApp-Dev.xcscheme", SCHEME_XML.format(e="Prod"))
        (self.root / SCHEMES / "iosApp-Prod.xcscheme").unlink()
        messages = self.messages()
        self.assertTrue(any("LaunchAction must use 'Debug-Dev'" in m for m in messages))
        self.assertIn("shared scheme 'iosApp-Prod' is missing", messages)

    def test_xcconfig_keys_required(self):
        self.write("iosApp/Configuration/Prod.xcconfig", "APP_ENV = Prod\n")
        self.assertTrue(any("missing or empty key API_BASE_URL" in m for m in self.messages()))

    def test_workflow_must_build_every_variant(self):
        (self.root.parent / WORKFLOW).write_text("dev debug", encoding="utf-8")
        messages = self.messages()
        self.assertIn("workflow does not build 'prod'", messages)
        self.assertIn("workflow does not build 'iosApp-Prod'", messages)


if __name__ == "__main__":
    unittest.main()
