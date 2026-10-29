"""Unit tests for scripts/capture_otp.py (WhatsApp OTP proof for the fixture capture, CUS-089)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import capture_otp  # noqa: E402


class FakeRecorder:
    """Answers request / verify from scripted lists and records every call."""

    def __init__(self, requests: list[dict], verify: dict):
        self.requests = list(requests)
        self.verify = verify
        self.calls: list[tuple[str, dict, bool]] = []

    def call(self, base, method, template, body=None, save=True, label=None, **_):
        self.calls.append((template, body, save))
        return self.requests.pop(0) if template == capture_otp.REQUEST_PATH else self.verify


class CaptureOtpTest(unittest.TestCase):
    def test_requests_then_verifies_with_the_fixed_code(self):
        rec = FakeRecorder([{"allowed": True}], {"otpToken": "tok"})
        token = capture_otp.otp_token(rec, "http://127.0.0.1:4000", "+962790000001", "LOGIN", "123456", 20)
        self.assertEqual("tok", token)
        self.assertEqual(
            [
                (capture_otp.REQUEST_PATH, {"phone": "+962790000001", "purpose": "LOGIN"}, False),
                (capture_otp.VERIFY_PATH, {"phone": "+962790000001", "purpose": "LOGIN", "code": "123456"}, False),
            ],
            rec.calls,
        )

    def test_waits_out_a_running_resend_countdown_once(self):
        rec = FakeRecorder([{"allowed": False, "resendAfterSeconds": 7}, {"allowed": True}], {"otpToken": "tok"})
        with mock.patch.object(capture_otp.time, "sleep") as sleep:
            token = capture_otp.otp_token(rec, "b", "+962790000002", "REGISTER", "123456", 20, save=True)
        sleep.assert_called_once_with(8)
        self.assertEqual("tok", token)
        self.assertEqual(3, len(rec.calls))
        self.assertTrue(all(save for _, _, save in rec.calls))

    def test_failed_verify_gives_an_empty_token(self):
        rec = FakeRecorder([{"allowed": False, "blockedUntil": "2026-10-26T10:00:00Z"}], None)
        self.assertEqual("", capture_otp.otp_token(rec, "b", "+962790000003", "CHANGE_PHONE", "000000", 20))


if __name__ == "__main__":
    unittest.main()
