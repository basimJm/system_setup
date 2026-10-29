import unittest
from support import KOTLIN, TempProject
from policy import hardcoded
from policy.hardcoded import check_kotlin_source, check_swift_source

SRC = "core/x/src/commonMain/kotlin/p/Screen.kt"
THEME = "core/design-system/src/commonMain/kotlin/p/designsystem/theme/Tokens.kt"


def rules(text: str, path: str = SRC) -> list[str]:
    return sorted(v.rule for v in check_kotlin_source(path, text, KOTLIN))


class KotlinHardcodedTest(unittest.TestCase):
    def test_colors(self):
        self.assertEqual(rules("val c = Color(0xFF112233)"), ["H001"])
        self.assertEqual(rules("val c = Color.Red"), ["H001"])
        self.assertEqual(rules("val c = Color.Transparent"), [])
        self.assertEqual(rules("val c = colors.primary"), [])

    def test_theme_files_may_define_values(self):
        self.assertEqual(rules("val c = Color(0xFF112233)\nval s = 16.dp\nval a = 0.38f", THEME), [])

    def test_dimensions(self):
        self.assertEqual(rules("Modifier.size(24.dp)"), ["H002"])
        self.assertEqual(rules("fontSize = 14.sp"), ["H002"])
        self.assertEqual(rules("Modifier.padding(0.dp)"), [])
        self.assertEqual(rules("Modifier.padding(spacing.space16)"), [])
        self.assertEqual(rules("val h = width.dp"), [])

    def test_dimensions_are_not_also_magic_numbers(self):
        self.assertEqual(rules("Modifier.size(24.dp)"), ["H002"])

    def test_magic_numbers(self):
        self.assertEqual(rules("delay(500)"), ["H006"])
        self.assertEqual(rules("alpha = 0.5f"), ["H006"])
        self.assertEqual(rules("repeat(3) { }"), ["H006"])
        self.assertEqual(rules("val x = 10_000L"), ["H006"])
        self.assertEqual(rules("val x = 0x1F"), ["H006"])

    def test_allowed_numbers(self):
        self.assertEqual(rules("val a = list[0]\nval b = n + 1\nval c = 1f\nval d = 0.0\nweight(1f)\nval e = -1"), [])

    def test_numbers_in_identifiers_comments_strings_annotations_and_const(self):
        text = (
            "val v2 = x1 + y_3\n// 77\n/* 88 */\nval s = \"99\"\n"
            "@Preview(widthDp = 360, heightDp = 640)\nfun P() {}\nprivate const val LIMIT = 300\n"
        )
        self.assertEqual(rules(text), [])

    def test_constants_and_preview_files_may_hold_numbers(self):
        self.assertEqual(rules("const val A = 5\nval b = 7", "core/x/src/commonMain/kotlin/p/constants/Limits.kt"), [])
        self.assertEqual(rules("val Pad = 14.dp\nval Size = 12.5.sp", "feature/x/src/commonMain/kotlin/p/screen/XDesignConstants.kt"), [])
        self.assertEqual(rules("val b = 7\nval c = 12.dp", "core/x/src/commonMain/kotlin/p/ButtonPreviews.kt"), ["H002"])

    def test_user_visible_text(self):
        self.assertEqual(rules('Text(text = "Retry")'), ["H003"])
        self.assertEqual(rules('AppText("Hello")'), ["H003"])
        self.assertEqual(rules('Icon(contentDescription = "Back")'), ["H003"])
        self.assertEqual(rules('val m = error ?: "Request failed"'), ["H003"])
        self.assertEqual(rules('Text(text = "مرحبا")'), ["H003"])

    def test_text_that_is_not_user_visible(self):
        self.assertEqual(rules('Text(text = "")'), [])
        self.assertEqual(rules('Text(text = "123")'), [])
        self.assertEqual(rules('Text(text = "${a}")'), [])
        self.assertEqual(rules('rememberInfiniteTransition(label = "shimmer")'), [])
        self.assertEqual(rules('Text(text = stringResource(Res.string.retry))'), [])
        self.assertEqual(rules('val tag = "SampleViewModel"'), [])

    def test_urls_and_secrets(self):
        self.assertEqual(rules('val u = "https://api.example.com"'), ["H004"])
        self.assertEqual(rules('val u = "10.0.2.2"'), ["H004"])
        self.assertEqual(rules('val k = "' + "AI" + "za" + "x" * 35 + '"'), ["H005"])
        self.assertEqual(rules('val apiKey = "' + "dummy" + "value1" + '"'), ["H005"])
        self.assertEqual(rules('val apiKey = ""'), [])

    def test_line_numbers(self):
        found = check_kotlin_source(SRC, "val a = 1\n\nval b = 24.dp\n", KOTLIN)
        self.assertEqual([(v.line, v.rule) for v in found], [(3, "H002")])


class SwiftHardcodedTest(unittest.TestCase):
    def test_swift(self):
        self.assertEqual([v.rule for v in check_swift_source("a.swift", 'let u = "https://x.com"')], ["H004"])
        self.assertEqual(check_swift_source("a.swift", '// https://docs.com\nlet a = 1'), [])


class RunnerTest(TempProject):
    def test_scans_only_production_sources(self):
        self.write("core/a/src/commonMain/kotlin/A.kt", "val a = 5\n")
        self.write("core/a/src/commonTest/kotlin/ATest.kt", "val a = 5\n")
        self.write("build-logic/convention/src/main/kotlin/B.kt", "val a = 5\n")
        found = hardcoded.check(self.config)
        self.assertEqual([v.path for v in found], ["core/a/src/commonMain/kotlin/A.kt"])


if __name__ == "__main__":
    unittest.main()
