"""Unit tests for scripts/contract_gaps.py (captured responses vs the OpenAPI contract, CUS-060)."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import contract_gaps  # noqa: E402

SHOP = {
    "type": "object",
    "required": ["id", "rating", "staff"],
    "properties": {
        "id": {"type": "string"},
        "rating": {"type": "number"},
        "count": {"type": "integer"},
        "note": {"type": ["string", "null"]},
        "gender": {"type": "string", "enum": ["MALE", "FEMALE"]},
        "staff": {"type": "array", "items": {"$ref": "#/components/schemas/Member"}},
    },
}
SPEC = {
    "paths": {"/app/v1/shops/{shopId}": {"get": {"responses": {"200": {"content": {"application/json": {"schema": {
        "type": "object", "properties": {"success": {"type": "boolean"}, "data": SHOP}}}}}}}}},
    "components": {"schemas": {"Member": {"type": "object", "required": ["name"], "properties": {"name": {"type": "string"}}}}},
}


def gaps(data) -> list[tuple[str, str, str]]:
    return contract_gaps.collapse(contract_gaps.diff(data, SHOP, SPEC["components"]["schemas"], "data"))


class ContractGapsTest(unittest.TestCase):
    def test_matching_response_has_no_gap(self) -> None:
        self.assertEqual([], gaps({"id": "s1", "rating": 4.5, "count": 2, "note": None, "gender": "MALE", "staff": [{"name": "A"}]}))

    def test_integer_is_a_valid_number_but_a_float_is_not_an_integer(self) -> None:
        self.assertEqual([], gaps({"id": "s1", "rating": 4, "staff": []}))
        self.assertEqual([("type", "data.count", "float, schema ['integer']")], gaps({"id": "s1", "rating": 4, "count": 1.5, "staff": []}))

    def test_missing_null_enum_and_undeclared_fields_are_reported(self) -> None:
        found = gaps({"id": None, "staff": [], "gender": "OTHER", "extra": 1})
        self.assertIn(("missing", "data.rating", "required field absent"), found)
        self.assertIn(("null", "data.id", "null, schema ['string']"), found)
        self.assertIn(("enum", "data.gender", "'OTHER' not in ['MALE', 'FEMALE']"), found)
        self.assertIn(("undeclared", "data.extra", "field not in the schema"), found)

    def test_list_items_follow_refs_and_fold_indexes(self) -> None:
        found = gaps({"id": "s1", "rating": 1, "staff": [{"name": 1}, {"name": 2}, {}]})
        self.assertEqual([("type", "data.staff[].name", "int, schema ['string']"), ("missing", "data.staff[].name", "required field absent")], found)

    def test_boolean_is_not_a_number(self) -> None:
        self.assertEqual([("type", "data.rating", "bool, schema ['number']")], gaps({"id": "s1", "rating": True, "staff": []}))

    def test_report_reads_fixtures_by_operation_id_and_main_fails_only_on_breaking_gaps(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec = root / "spec.json"
            spec.write_text(json.dumps(SPEC), encoding="utf-8")
            fixtures = root / "fixtures"
            fixtures.mkdir()
            (fixtures / "GetShopsByShopId.json").write_text(json.dumps({"data": {"id": "s1", "rating": 1, "staff": [], "x": 1}}), encoding="utf-8")
            (fixtures / "Unknown.json").write_text(json.dumps({"data": None}), encoding="utf-8")
            self.assertEqual([("GetShopsByShopId", "undeclared", "data.x", "field not in the schema")], contract_gaps.report(SPEC, fixtures))
            self.assertEqual(0, contract_gaps.main(["--spec", str(spec), "--fixtures", str(fixtures)]))
            (fixtures / "GetShopsByShopId.json").write_text(json.dumps({"data": {"id": "s1", "staff": []}}), encoding="utf-8")
            self.assertEqual(1, contract_gaps.main(["--spec", str(spec), "--fixtures", str(fixtures)]))


if __name__ == "__main__":
    unittest.main()
