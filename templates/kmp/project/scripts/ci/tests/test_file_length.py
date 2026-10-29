import unittest
from support import TempProject
from policy import file_length


class FileLengthTest(TempProject):
    def lines(self, rel_path, count):
        self.write(rel_path, "val a = 1\n" * count)

    def test_limit_is_inclusive(self):
        self.lines("core/a/A.kt", 300)
        self.lines("core/a/B.kt", 301)
        found = file_length.check(self.config)
        self.assertEqual([(v.path, v.line) for v in found], [("core/a/B.kt", 301)])

    def test_last_line_without_newline_counts(self):
        self.write("core/a/A.kt", "x\n" * 300 + "y")
        self.assertEqual(len(file_length.check(self.config)), 1)

    def test_excluded_paths_and_other_extensions(self):
        self.lines("androidApp/src/main/res/drawable/big.xml", 500)
        self.lines("core/build/generated/G.kt", 500)
        self.lines("core/a/notes.txt", 500)
        self.assertEqual(file_length.check(self.config), [])

    def test_xml_values_are_limited(self):
        self.lines("core/a/src/commonMain/composeResources/values/strings.xml", 301)
        self.assertEqual(len(file_length.check(self.config)), 1)


if __name__ == "__main__":
    unittest.main()
