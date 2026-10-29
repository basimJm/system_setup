# Domain reference

Business rules, entities and the backend contract of this app live here. The policy check `error-codes`
(`scripts/ci/policy/error_codes.py`) compares section 11 with `ErrorCode` (core/domain), the AR + EN
`error_code_<code>` strings and `ErrorHandling` (core/design-system): when the backend adds an error code,
add it to section 11 and to those three places.

## 11. Error Codes

```
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
PERMISSION_DENIED
NOT_FOUND
CONFLICT
RATE_LIMITED
INTERNAL
OTP_BLOCKED
OTP_INVALID
OTP_EXPIRED
PHONE_NOT_REGISTERED
PHONE_ALREADY_REGISTERED
ACCOUNT_BLOCKED
UPLOAD_INVALID
UPLOAD_TOO_LARGE
MAINTENANCE
UPDATE_REQUIRED
CURRENT_PASSWORD_INVALID
EMAIL_ALREADY_USED
```
