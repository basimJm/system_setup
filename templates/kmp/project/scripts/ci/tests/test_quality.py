import unittest
from support import TempProject
from policy import quality
from policy.quality import check_source

PATH = "core/x/src/commonMain/kotlin/p/A.kt"


def rules(text: str) -> list[str]:
    return sorted(v.rule for v in check_source(PATH, text))


class QualityTest(unittest.TestCase):
    def test_crash_prone_constructs(self):
        self.assertEqual(rules("val a = b!!"), ["Q001"])
        self.assertEqual(rules('println("x")'), ["Q002"])
        self.assertEqual(rules("e.printStackTrace()"), ["Q002"])
        self.assertEqual(rules("GlobalScope.launch { }"), ["Q003"])
        self.assertEqual(rules("runBlocking { }"), ["Q004"])
        self.assertEqual(rules("try { a() } catch (e: Exception) { }"), ["Q005"])
        self.assertEqual(rules("TODO()"), ["Q007"])

    def test_safe_code_passes(self):
        self.assertEqual(rules("val a = b ?: return\nif (x != y) { }\ntry { a() } catch (e: Exception) { log(e) }"), [])

    def test_text_in_strings_and_comments_is_ignored(self):
        self.assertEqual(rules('val s = "a!!b println("\n// runBlocking GlobalScope\n'), [])

    def test_suppress_needs_a_reason(self):
        self.assertEqual(rules("@Suppress(\"UNCHECKED_CAST\")\nfun a() {}"), ["Q006"])
        self.assertEqual(rules("// cast is checked above\n@Suppress(\"UNCHECKED_CAST\")\nfun a() {}"), [])
        self.assertEqual(rules("@Suppress(\"UNCHECKED_CAST\") // checked above\nfun a() {}"), [])

    def test_performance_rules(self):
        self.assertEqual(rules("val s by flow.collectAsState()"), ["P002"])
        self.assertEqual(rules("val s by flow.collectAsStateWithLifecycle()"), [])
        self.assertEqual(rules("Thread.sleep(5)"), ["P003"])

    def test_nested_comment_opener_is_reported(self):
        self.assertEqual(rules("/** see design/*.json for tokens */\nval a = 1"), ["Q008"])
        self.assertEqual(rules("/* a /* b */ c */\nval a = 1"), ["Q008"])
        self.assertEqual(rules("/** plain doc */\nval a = 1\n// a/*b"), [])

    def test_lazy_items_need_keys(self):
        lazy = "LazyColumn {\n    %s\n}"
        self.assertEqual(rules(lazy % "items(list) { Row() }"), ["P001"])
        self.assertEqual(rules(lazy % "itemsIndexed(list) { i, v -> Row() }"), ["P001"])
        self.assertEqual(rules(lazy % "items(list, key = { it.id }, contentType = { 0 }) { Row() }"), [])
        self.assertEqual(rules(lazy % "items(count = 5) { Shimmer() }"), [])
        self.assertEqual(rules("val x = items(list)"), [])


class QualityRunnerTest(TempProject):
    def test_runner_scans_production_only(self):
        self.write("core/a/src/commonMain/kotlin/A.kt", "val a = b!!\n")
        self.write("core/a/src/commonTest/kotlin/ATest.kt", "val a = b!!\n")
        self.assertEqual([v.path for v in quality.check(self.config)], ["core/a/src/commonMain/kotlin/A.kt"])


if __name__ == "__main__":
    unittest.main()
