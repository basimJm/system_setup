import unittest
from support import CI_DIR  # noqa: F401
from policy.kotlin_lexer import lex


class LexerTest(unittest.TestCase):
    def test_keeps_length_and_newlines(self):
        src = 'val a = "x\\"y" // c\n/* 1\n2 */ val b = 3\n'
        masked, _ = lex(src)
        self.assertEqual(len(masked), len(src))
        self.assertEqual(masked.count("\n"), src.count("\n"))

    def test_blanks_comments_strings_and_chars(self):
        masked, strings = lex("val a = \"hi 12.dp\" // 5.dp\nval c = 'x'")
        self.assertNotIn("12", masked)
        self.assertNotIn("5.dp", masked)
        self.assertEqual([s.content for s in strings], ["hi 12.dp"])

    def test_string_positions(self):
        _, strings = lex('val a = 1\nval b = "yy"')
        self.assertEqual((strings[0].line, strings[0].column), (2, 8))

    def test_templates_and_nested_strings_stay_inside_the_literal(self):
        _, strings = lex('val a = "a ${b + "q"} c"\nval d = "z"')
        self.assertEqual([s.content for s in strings], ['a ${b + "q"} c', "z"])

    def test_raw_strings_span_lines(self):
        masked, strings = lex('val a = """x\n 99 """\nval b = 7')
        self.assertNotIn("99", masked)
        self.assertEqual(strings[0].line, 1)
        self.assertIn("val b = 7", masked)

    def test_nested_block_comments(self):
        masked, _ = lex("a /* x /* y */ 5 */ b 6")
        self.assertNotIn("5", masked)
        self.assertIn("6", masked)

    def test_unterminated_string_does_not_hang(self):
        masked, _ = lex('val a = "abc\nval b = 2')
        self.assertIn("val b = 2", masked)


if __name__ == "__main__":
    unittest.main()
