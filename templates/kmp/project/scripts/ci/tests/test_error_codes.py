import unittest
from policy import error_codes

DOC = "intro\n## 11. Error Codes (API `code` field)\n\n```\nVALIDATION_ERROR  NOT_FOUND\nSLOT_TAKEN\n```\n\n---\n## 12. Other\nNOT_A_CODE\n"
SNAPSHOT = '{"code": {"type": "string", "enum": ["VALIDATION_ERROR", "NOT_FOUND", "DRAFT_EXPIRED"]}}'
ENUM = "package x\nenum class ErrorCode {\n    VALIDATION_ERROR,\n    NOT_FOUND,\n    SLOT_TAKEN,\n    DRAFT_EXPIRED,\n    UNKNOWN,\n    ;\n    companion object {}\n}\n"


class ErrorCodesTest(unittest.TestCase):
    def test_parsers_pick_only_the_contract_codes(self):
        self.assertEqual(error_codes.domain_codes(DOC), {"VALIDATION_ERROR", "NOT_FOUND", "SLOT_TAKEN"})
        self.assertEqual(error_codes.snapshot_codes(SNAPSHOT), {"VALIDATION_ERROR", "NOT_FOUND", "DRAFT_EXPIRED"})
        self.assertEqual(error_codes.enum_codes(ENUM), {"VALIDATION_ERROR", "NOT_FOUND", "SLOT_TAKEN", "DRAFT_EXPIRED", "UNKNOWN"})
        self.assertEqual(error_codes.handled_codes("ErrorCode.SLOT_TAKEN -> X\nErrorCode.UNKNOWN -> Y"), {"SLOT_TAKEN", "UNKNOWN"})
        self.assertEqual(error_codes.string_keys('<string name="error_code_slot_taken">x</string><string name="other">y</string>'), {"slot_taken"})


if __name__ == "__main__":
    unittest.main()
