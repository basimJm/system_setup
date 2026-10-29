"""Phone proof for the fixture capture (CUS-089, BUSINESS_DOMAIN §3.1a): WhatsApp OTP request + verify on a local stack
running `OTP_PROVIDER=fake OTP_FIXED_CODE=<code>`, answering the single-use `otpToken`."""
from __future__ import annotations

import time

REQUEST_PATH = "/auth/otp/request"
VERIFY_PATH = "/auth/otp/verify"
ATTEMPTS = 2


def otp_token(rec, base: str, e164: str, purpose: str, code: str, wait_s: int, save: bool = False) -> str:
    """Requests a code (waiting out a running resend countdown once), verifies it, returns the `otpToken` ('' on failure)."""
    for _ in range(ATTEMPTS):
        sent = rec.call(base, "POST", REQUEST_PATH, body={"phone": e164, "purpose": purpose}, save=save,
                        label=None if save else f"PostAuthOtpRequest({purpose})") or {}
        if sent.get("allowed") or sent.get("blockedUntil"):
            break
        time.sleep(int(sent.get("resendAfterSeconds") or wait_s) + 1)
    verified = rec.call(base, "POST", VERIFY_PATH, body={"phone": e164, "purpose": purpose, "code": code}, save=save,
                        label=None if save else f"PostAuthOtpVerify({purpose})") or {}
    return verified.get("otpToken", "")
