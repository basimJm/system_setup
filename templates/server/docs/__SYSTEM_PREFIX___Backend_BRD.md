# **SYSTEM_NAME** — Backend BRD

> Requirement ids referenced by tasks and the security checklist.

| ID     | Requirement                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------- |
| BE-01  | Three API namespaces with separate token scopes and one response envelope                      |
| BE-02  | Phone OTP sign-in for customers and merchant members; admin email + password + emailed code    |
| BE-03  | Rotating refresh tokens; reuse revokes the family                                              |
| BE-04  | Merchant permissions granted by the owner and enforced on every route, socket and notification |
| BE-05  | Every admin write carries a reason and lands in the append-only audit log                      |
| BE-06  | Settings registry with defaults, validation and shared cache                                   |
| BE-07  | Uploads: presign → direct upload → confirm; private documents via signed URLs                  |
| BE-08  | Notifications stored in both languages, pushed in the recipient's language                     |
| BE-09  | Generated OpenAPI + Postman kept in the repo; contract guard                                   |
| NFR-01 | Security controls of `docs/SECURITY_CHECKLIST.md`                                              |
| NFR-02 | Arabic default and English on every response                                                   |
| NFR-03 | Common reads answer within ~300 ms at p95 (`npm run loadtest`)                                 |
