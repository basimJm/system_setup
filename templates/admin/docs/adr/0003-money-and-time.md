# ADR-0003 — Money and time

- **Status:** accepted (ADM-008)
- **Context:** the server stores money as integer minor units and sends amounts as decimal strings; instants are UTC; business hours and reports follow one platform time zone (`BUSINESS_TIME_ZONE`); the PRDs ask for a 12-hour clock and numerals that follow the language.
- **Decision:** the client never uses floats for money: amounts are `MoneyString`, converted to integer minor units (BigInt-checked) only to add or compare. Instants stay ISO/UTC and are formatted in the business zone (`BUSINESS_TIME_ZONE`) through `Intl`, with the zone as a parameter (no hardcoded offset). Arabic uses Arabic-Indic digits, English Latin digits. The currency name comes from the locale files.
- **Consequences:** one kernel (`src/domain/shared`) mirrors the server's `utils/money` and `utils/time`; features must not format money or dates themselves.
