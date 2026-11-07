# __SDK_TITLE__ — Business Requirements (__SYSTEM_NAME__)

> Status: generated skeleton. The tool knows only what the plan recorded; the sections marked `PENDING` need the owner.

## 1. Purpose
__SDK_DESCRIPTION__

## 2. Scope
`__NPM_SCOPE__/__SDK_KIND__` hides the vendor behind one port (`__SDK_TITLE__Port`). It holds no __SYSTEM_NAME__ business rules: the server decides *when* and *why*; this package only performs the operation reliably.

## 3. Requirements
| ID | Requirement | Status |
|---|---|---|
| __SDK_PREFIX__-R1 | Define the operations the port offers (replace the generic `execute`) and their request and result shapes. | PENDING |
| __SDK_PREFIX__-R2 | Map every vendor status and error to an `SdkError` code; mark retryable ones. | PENDING |
| __SDK_PREFIX__-R3 | Dev runs on the fake adapter with no credentials; prod refuses fakes and requires secrets. | DONE (generated) |
| __SDK_PREFIX__-R4 | Unit tests for every file and function; the coverage gate stays on. | DONE (generated) |

## 4. Open points
- Which operations does __SYSTEM_NAME__ need from this package? (`PENDING`, owner)
- Which provider, and under which account and limits? See `.claude/Integration.md` §Providers.
