"""Unit tests for scripts/api_sync.py (the Kotlin contract generator)."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import api_sync  # noqa: E402

SPEC = {
    "paths": {
        "/app/v1/shops/{shopId}": {
            "get": {
                "tags": ["Shop details"],
                "parameters": [{"name": "shopId", "in": "path", "required": True, "schema": {"type": "string"}}],
                "responses": {"200": {"content": {"application/json": {"schema": {"type": "object", "properties": {
                    "success": {"type": "boolean"},
                    "data": {"type": "object", "required": ["id", "staff"], "properties": {
                        "id": {"type": "string"},
                        "rating": {"type": ["number", "null"]},
                        "gender": {"type": "string", "enum": ["MALE", "FEMALE"]},
                        "staff": {"type": "array", "items": {"type": "object", "required": ["name"], "properties": {"name": {"type": "string"}}}},
                        "object": {"type": "boolean"},
                    }},
                }}}}}},
            },
        },
        "/app/v1/favorites/{shopId}": {
            "put": {"tags": ["Favorites"], "requestBody": {"content": {"application/json": {"schema": {"type": "object", "properties": {"note": {"type": "string"}}}}}},
                    "responses": {"200": {"content": {"application/json": {"schema": {"type": "object", "properties": {"data": {"type": "null"}}}}}}}},
        },
    },
    "components": {"schemas": {"CustomerProfile": {"type": "object", "required": ["id"], "properties": {"id": {"type": "string"}, "email": {"type": ["string", "null"]}}}}},
}


class ApiSyncTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.spec = Path(self.tmp.name) / "openapi.customer.json"
        self.spec.write_text(json.dumps(SPEC), encoding="utf-8")
        self.out = Path(self.tmp.name) / "generated"
        self.test_out = Path(self.tmp.name) / "generated-test"
        self.captured = Path(self.tmp.name) / "captured"
        self.files, self.sha, self.test_files = api_sync.generate(self.spec)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_operation_ids_follow_method_and_path(self) -> None:
        self.assertEqual("GetShopsByShopId", api_sync.operation_id("get", "/app/v1/shops/{shopId}"))
        self.assertEqual("PostBookingsDraftsByIdVerifyOtp", api_sync.operation_id("post", "/app/v1/bookings/drafts/{id}/verify-otp"))

    def test_data_classes_nullability_enums_and_nested_items(self) -> None:
        kotlin = self.files["ShopDetailsDtos.kt"]
        self.assertIn("data class GetShopsByShopIdData(", kotlin)
        self.assertIn("    val id: String,", kotlin)
        self.assertIn("    val rating: Double? = null,", kotlin)
        self.assertIn("/** One of: MALE, FEMALE. */\n    val gender: String? = null,", kotlin)
        self.assertIn("val staff: List<GetShopsByShopIdDataStaffItem>,", kotlin)
        self.assertIn("data class GetShopsByShopIdDataStaffItem(", kotlin)
        self.assertIn('@SerialName("object")\n    val `object`: Boolean? = null,', kotlin)
        self.assertIn("data class CustomerProfile(", self.files["Components.kt"])
        self.assertIn("val email: String? = null,", self.files["Components.kt"])

    def test_operations_registry_lists_every_operation(self) -> None:
        ops = self.files["Operations.kt"]
        self.assertIn('val getShopsByShopId = Operation(', ops)
        self.assertIn('pathParams = listOf("shopId"),', ops)
        self.assertIn('dataType = "GetShopsByShopIdData",', ops)
        self.assertIn('val putFavoritesByShopId = Operation(', ops)
        self.assertIn('bodyType = "PutFavoritesByShopIdBody",', ops)
        self.assertIn("        getShopsByShopId,\n        putFavoritesByShopId,\n", ops)
        self.assertIn(self.sha, ops)

    def test_fixtures_follow_the_response_schema(self) -> None:
        fixtures = self.files["MockFixtures.kt"]
        self.assertIn('"GetShopsByShopId" to "', fixtures)
        decoded = api_sync.sample_value(SPEC["paths"]["/app/v1/shops/{shopId}"]["get"]["responses"]["200"]["content"]["application/json"]["schema"]["properties"]["data"], "data", {})
        self.assertEqual("id-1", decoded["id"])
        self.assertEqual(["id-1", "id-2", "id-3"], [item["id"] for item in api_sync.sample_value({"type": "array", "items": {"type": "object", "properties": {"id": {"type": "string"}}}}, "items", {})])
        self.assertEqual("MALE", decoded["gender"])
        self.assertEqual(3, len(decoded["staff"]))
        self.assertEqual(api_sync.TEXT_MARKER, decoded["staff"][0]["name"])
        self.assertEqual(1.5, decoded["rating"])
        self.assertIn('"PutFavoritesByShopId" to "', fixtures)
        country = api_sync.sample_value({"type": "object", "properties": {"code": {"type": "string"}, "dialCode": {"type": "string"}, "phoneRegex": {"type": "string"}}}, "c", {})
        self.assertEqual({"code": "XA", "dialCode": "+991", "phoneRegex": "^7[789][0-9]{7}$"}, country)
        otp = api_sync.sample_value({"type": "object", "properties": {"allowed": {"type": "boolean"}, "otpLength": {"type": "integer"}, "enabled": {"type": "boolean"}}}, "o", {})
        self.assertEqual({"allowed": True, "otpLength": 6, "enabled": False}, otp)

    def test_branch_samples_show_several_branches_with_one_main_first(self) -> None:
        card = api_sync.sample_value({"type": "object", "properties": {"branchCount": {"type": "number"}}}, "card", {})
        self.assertEqual(3, card["branchCount"])
        branches = api_sync.sample_value(
            {"type": "array", "items": {"type": "object", "properties": {"id": {"type": "string"}, "isMain": {"type": "boolean"}}}}, "branches", {})
        self.assertEqual([True, False, False], [b["isMain"] for b in branches])

    def args(self, *extra: str) -> list[str]:
        return [*extra, "--spec", str(self.spec), "--out", str(self.out), "--test-out", str(self.test_out), "--captured", str(self.captured)]

    def test_check_mode_detects_stale_and_extra_files(self) -> None:
        self.assertEqual(1, api_sync.main(self.args("--check")))
        self.assertEqual(0, api_sync.main(self.args()))
        self.assertEqual(0, api_sync.main(self.args("--check")))
        (self.out / "Old.kt").write_text("x", encoding="utf-8")
        self.assertEqual(1, api_sync.main(self.args("--check")))
        self.assertEqual(0, api_sync.main(self.args()))
        self.assertFalse((self.out / "Old.kt").exists())
        self.assertTrue((self.test_out / api_sync.DECODERS_FILE).is_file())

    def test_captured_response_replaces_the_schema_fixture_with_data_last(self) -> None:
        self.captured.mkdir()
        real = {"success": True, "data": [{"id": "s1"}], "meta": {"page": 1, "pageSize": 10, "total": 1}, "message": "Done"}
        (self.captured / "GetShopsByShopId.json").write_text(json.dumps(real), encoding="utf-8")
        files, _, _ = api_sync.generate(self.spec, self.captured)
        fixtures = files["MockFixtures.kt"]
        self.assertIn('\\"meta\\": {\\"page\\": 1, \\"pageSize\\": 10, \\"total\\": 1}, \\"data\\": [{\\"id\\": \\"s1\\"}]}', fixtures)
        self.assertIn('val captured: Set<String> = setOf(\n        "GetShopsByShopId",\n    )', fixtures)
        self.assertIn('val captured: Set<String> = setOf(\n    )', self.files["MockFixtures.kt"])

    def test_decoders_map_every_operation_to_its_data_serializer(self) -> None:
        decoders = self.test_files[api_sync.DECODERS_FILE]
        self.assertIn('"GetShopsByShopId" to serializer<GetShopsByShopIdData>(),', decoders)
        self.assertIn('"PutFavoritesByShopId" to serializer<JsonElement>(),', decoders)
        self.assertIn(self.sha, decoders)


if __name__ == "__main__":
    unittest.main()
